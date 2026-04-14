const express = require("express");
const path = require("path");
const {check, validationResult} = require('express-validator');
const mongoose = require("mongoose");
const session = require("express-session");
const MongoStore = require("connect-mongo");

const Order = mongoose.model("Order", {
    name: String,
    email: String,
    phone: String,
    postcode: String,
    lunch: String,
    tickets: Number,
    campus: String,
    sub: Number,
    tax: Number,
    total: Number
});

const Admin = mongoose.model("Admin", {
    username: String,
    password: String
});

const app = express();

app.use(session({
    secret: "mysecret",
    resave: false,
    saveUninitialized: true,
    store: MongoStore.create({                                                               // ← add this
        mongoUrl: "mongodb+srv://alexbadila:Yo3kpaxy@cluster0.bwb3wky.mongodb.net/CollegeOrder"  // ← add this
    })                                                                                       // ← add this
}));

// Connection caching for serverless
let isConnected = false;
async function connectDB() {
    if (isConnected) return;
    await mongoose.connect("mongodb+srv://alexbadila:Yo3kpaxy@cluster0.bwb3wky.mongodb.net/CollegeOrder");
    isConnected = true;
}

app.use(express.urlencoded({extended: false}));
app.set("views", path.join(__dirname, "views"));
app.use(express.static(__dirname + "/public"));
app.set("view engine", "ejs");

app.get("/", async (req, res) => {
    res.render("form");
});

app.get("/login", async (req, res) => {
    res.render("login");
});

app.post("/login", [
    check("uname", "UserName Empty").notEmpty(),
    check("pass", "Password Empty").notEmpty()
], async (req, res) => {
    let errors = validationResult(req);

    if(errors.isEmpty())
    {
        await connectDB();
        Admin.findOne({ username: req.body.uname }).then((data) => {
            if (data === null || data.password !== req.body.pass) {
                res.render("login", { loginError: "Username or Password Incorrect" });
            } 
            else {
                req.session.loggedIn  = true;
                req.session.user = data.username;
                // res.render("orders", {logged:{
                //     name: req.session.user ,
                //     sstatus: req.session.loggedIn
                // }});
                res.redirect("/allOrders");
            }
        }).catch((err) => {
            console.log(err);
        });
    }
});

app.get("/logout", async (req, res) => {
    req.session.destroy();
    res.redirect("/login");
});

app.get("/update/:ids", async (req, res) => {
    if (!req.session.loggedIn) return res.redirect("/login");

    await connectDB();
    let id = req.params.ids;
    Order.findOne({ _id: id }).then(data => {
        if (!data) return res.redirect("/allOrders");
        res.render("update", { order: data, id: data._id });
    }).catch(err => console.log(err));
});

app.post("/update/:ids", [
    check("name", "Name is empty").notEmpty(),
    check("email", "Not a valid email").isEmail(),
    check("tickets", "Ticket not selected").notEmpty().custom(value => {
        if(isNaN(value)) {
            throw Error("This is not a number");
        } else if(value <= 0) {
            throw Error("Not a positive number");
        } else {
            return true;
        }
    }),
    check("campus", "Campus not selected").notEmpty(),
    check("lunch", "Select yes/no for lunch").notEmpty(),
    check("postcode", "Invalid Post Code Format").matches(/^[a-zA-Z]\d[a-zA-Z]\s\d[a-zA-Z]\d$/),
    check("phone", "Invalid phone number").matches(/^\d{3}(\s|-)\d{3}(\s|-)\d{4}$/),
    check("lunch").custom((value, {req}) => {
        if(typeof(value) !== "undefined") {
            if(value === "yes" && req.body.tickets < 3) {
                throw Error("When lunch === yes buy 3 or more tickets")
            }
        } else {
            throw Error("Lunch selection (yes/no) not completed")
        }
        return true;
    })
], async (req, res) => {
    const errors = validationResult(req);
    let id = req.params.ids;
    if(errors.isEmpty()) {
        await connectDB();    
        Order.findOne({_id: id}).then(data => {
            if(!data) {
                return res.redirect("/allOrders");
            }

            data.name = req.body.name;
            data.email = req.body.email;
            data.phone = req.body.phone;
            data.postcode = req.body.postcode;
            data.lunch = req.body.lunch;
            data.tickets = req.body.tickets;
            data.campus = req.body.campus;

            let cost = 0;
            if(data.tickets > 0){ cost = 100 * data.tickets; }
            if(data.lunch == 'yes'){ cost += 60; }

            let tax = cost * 0.13;
            let total = cost + tax;

            data.sub = cost.toFixed(2);
            data.tax = tax.toFixed(2);
            data.total = total.toFixed(2);
            
            data.save().then(datasaved => {
                res.redirect("/allOrders");
            }).catch(err => {
                console.log(err);
            }); 

        });
    } 
    else {
        res.render("update", { order: req.body, errors: errors.array(), id: id });
    }
});

app.get("/delete/:ids", async (req, res) => {
    await connectDB();
    let id = req.params.ids;
    // console.log(id);
    Order.findOneAndDelete({_id: id}).then(data => {
        if(data !== null) {
            res.redirect("/allOrders");
        }
        else {
            console.log("Error deleting data");
        }
    })
    .catch(err => {
        console.log(err);
    });
});

app.post("/processForm", [
    check("name", "Name is empty").notEmpty(),
    check("email", "Not a valid email").isEmail(),
    check("tickets", "Ticket not selected").notEmpty().custom(value => {
        if(isNaN(value)) {
            throw Error("This is not a number");
        } else if(value <= 0) {
            throw Error("Not a positive number");
        } else {
            return true;
        }
    }),
    check("campus", "Campus not selected").notEmpty(),
    check("lunch", "Select yes/no for lunch").notEmpty(),
    check("postcode", "Invalid Post Code Format").matches(/^[a-zA-Z]\d[a-zA-Z]\s\d[a-zA-Z]\d$/),
    check("phone", "Invalid phone number").matches(/^\d{3}(\s|-)\d{3}(\s|-)\d{4}$/),
    check("lunch").custom((value, {req}) => {
        if(typeof(value) !== "undefined") {
            if(value === "yes" && req.body.tickets < 3) {
                throw Error("When lunch === yes buy 3 or more tickets")
            }
        } else {
            throw Error("Lunch selection (yes/no) not completed")
        }
        return true;
    })
], async (req, res) => {
    const errors = validationResult(req);
    if(errors.isEmpty()) {
        let name = req.body.name;
        let email = req.body.email;
        let campus = req.body.campus;
        let tickets = req.body.tickets;
        let lunch = req.body.lunch;
        var lunch_index = -1;
        let tax, total;

        for(var i = 0; i < lunch.length; i++){
            if(lunch[i].checked){
                lunch_index = i;
                break;
            }
        }
        if(lunch_index > -1){
            lunch = lunch[lunch_index].value;
        }

        var cost = 0;
        if(tickets > 0){ cost = 100 * tickets; }
        if(lunch == 'yes'){ cost += 60; }

        tax = cost * 0.13;
        total = cost + tax;

        let receipt = {
            "name": name,
            "email": email,
            "lunch": lunch,
            "campus": campus,
            "sub": cost.toFixed(2),
            "tax": tax.toFixed(2),
            "total": total.toFixed(2)
        }

        await connectDB(); // ← connect before DB operations
        let newOrder = new Order({
            name: receipt.name,
            email: receipt.email,
            phone: req.body.phone,
            postcode: req.body.postcode,
            lunch: receipt.lunch,
            tickets: tickets,
            campus: receipt.campus,
            sub: receipt.sub,
            tax: receipt.tax,
            total: receipt.total
        });

        newOrder.save().then(data => {
            res.render("form", {recpt: data});
        }).catch(err => {
            console.log("Data Saving Error!!!");
        });

    } else {
        res.render("form", {errors: errors.array()});
    }
});

app.get("/allOrders", async (req, res) => {
    if(req.session.loggedIn) {
        await connectDB(); // ← connect before DB operations
        Order.find({}).then(data => {
            res.render("orders", {data: data, logged:{
                    name: req.session.user,
                    status: req.session.loggedIn
                }});
        }).catch(err => {
            console.log("Data read error");
        });
    }
    else {
        res.redirect("/login");
    }
    
});

// Export for Vercel
module.exports = app;

// Only listen when running locally
if (process.env.NODE_ENV !== "production") {
    app.listen(3000, () => {
        console.log('Server running on http://localhost:3000');
    });
}