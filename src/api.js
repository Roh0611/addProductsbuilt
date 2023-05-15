const express = require("express");
const cors = require("cors");
const mongoose = require("mongoose");
const bodyParser = require('body-parser');
const serverless = require("serverless-http");
const dotenv = require("dotenv");
const cloudinaryModule = require("cloudinary");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");
const Joi = require("joi");
const router = express.Router();
////////////////////////////////////////////////////////////////////////////////////////////////////////

const userSchema = new mongoose.Schema(
    {
        name: { type: String, required: true, minlength: 3, maxlength: 30 },
        email: {
            type: String,
            required: true,
            minlength: 3,
            maxlength: 200,
            unique: true,
        },
        password: { type: String, required: true, minlength: 3, maxlength: 1024 },
        isAdmin: { type: Boolean, default: false },
    },
    { timestamps: true }
);

const User = mongoose.model("User", userSchema);


const generateAuthToken = (user) => {
    const jwtSecretKey = "ABRADARBA";
    const token = jwt.sign(
        {
            _id: user._id,
            name: user.name,
            email: user.email,
            isAdmin: user.isAdmin,
        },
        jwtSecretKey
    );

    return token;
};

router.post("/register", async (req, res) => {
    const schema = Joi.object({
        name: Joi.string().min(3).max(30).required(),
        email: Joi.string().min(3).max(200).required().email(),
        password: Joi.string().min(6).max(200).required(),
    });

    const { error } = schema.validate(req.body);

    if (error) return res.status(400).send(error.details[0].message);

    let user = await User.findOne({ email: req.body.email });
    if (user) return res.status(400).send("User already exists...");

    console.log("here");

    const { name, email, password } = req.body;

    user = new User({ name, email, password });

    const salt = await bcrypt.genSalt(10);
    user.password = await bcrypt.hash(user.password, salt);

    await user.save();

    const token = generateAuthToken(user);

    res.send(token);
});

////////////////////////////////////////////////////////////////////////////////////////////////////////

router.post("/login", async (req, res) => {
    const schema = Joi.object({
        email: Joi.string().min(3).max(200).required().email(),
        password: Joi.string().min(6).max(200).required(),
    });

    const { error } = schema.validate(req.body);

    if (error) return res.status(400).send(error.details[0].message);

    let user = await User.findOne({ email: req.body.email });
    if (!user) return res.status(400).send("Invalid email or password...");

    const validPassword = await bcrypt.compare(req.body.password, user.password);
    if (!validPassword)
        return res.status(400).send("Invalid email or password...");

    const token = generateAuthToken(user);

    res.send(token);
});

////////////////////////////////////////////////////////////////////////////////////////////////////////
const productSchema = new mongoose.Schema(
    {
        name: { type: String, required: true },
        brand: { type: String, required: true },
        desc: { type: String, required: true },
        price: { type: Number, required: true },
        image: { type: Object, required: true },
    },
    { timestamps: true }
);

const Product = mongoose.model("Product", productSchema);

const auth = (req, res, next) => {
    const token = req.header("x-auth-token");
    if (!token)
        return res.status(401).send("Access denied. Not authenticated...");
    try {
        const jwtSecretKey = "ABRADARBA";
        const decoded = jwt.verify(token, jwtSecretKey);

        req.user = decoded;
        next();
    } catch (ex) {
        res.status(400).send("Invalid auth token...");
    }
};


// For Admin
const isAdmin = (req, res, next) => {
    auth(req, res, () => {
        if (req.user.isAdmin) {
            next();
        } else {
            res.status(403).send("Access denied. Not authorized...");
        }
    });
};

////////////////////////////////////////////////////////////////////////////////

dotenv.config();
const cloudinary = cloudinaryModule.v2;

cloudinary.config({
    cloud_name: "dnhsfdkwz",
    api_key: "544585694892298",
    api_secret: "ZTa_oxnwNnWcaLb34o-2zP6C5ho",
});

/////////////////////////////////////////////////////////////////////////////////

//CREATE

router.post("/products", isAdmin, async (req, res) => {
    const { name, brand, desc, price, image } = req.body;

    try {
        if (image) {
            const uploadedResponse = await cloudinary.uploader.upload(image, {
                upload_preset: "avalanche",
            });

            if (uploadedResponse) {
                const product = new Product({
                    name,
                    brand,
                    desc,
                    price,
                    image: uploadedResponse,
                });

                const savedProduct = await product.save();
                res.status(200).send(savedProduct);
            }
        }
    } catch (error) {
        console.log(error);
        res.status(500).send(error);
    }
});

//DELETE

router.delete("/products/:id", isAdmin, async (req, res) => {
    try {
        await Product.findByIdAndDelete(req.params.id);
        res.status(200).send("Product has been deleted...");
    } catch (error) {
        res.status(500).send(error);
    }
});

//GET ALL PRODUCTS

router.get("/products", async (req, res) => {
    const qbrand = req.query.brand;
    try {
        let products;

        if (qbrand) {
            products = await Product.find({
                brand: qbrand,
            });
        } else {
            products = await Product.find();
        }

        res.status(200).send(products);
    } catch (error) {
        res.status(500).send(error);
    }
});

//GET PRODUCT

router.get("/products/find/:id", async (req, res) => {
    try {
        const product = await Product.findById(req.params.id);
        res.status(200).send(product);
    } catch (error) {
        res.status(500).send(error);
    }
});

//UPDATE

router.put("/products/:id", isAdmin, async (req, res) => {
    try {
        const updatedProduct = await Product.findByIdAndUpdate(
            req.params.id,
            {
                $set: req.body,
            },
            { new: true }
        );
        res.status(200).send(updatedProduct);
    } catch (error) {
        res.status(500).send(error);
    }
});

////////////////////////////////////////////////////////////////////////////////////////////////////////
const app = express();
require('dotenv').config();
app.use(cors()); // enable CORS
app.use(bodyParser.json({ limit: '10mb' }));
app.use(bodyParser.urlencoded({ extended: true, limit: '10mb' }));

router.get("/", (req, res) => {
    res.json({
        hello: "hi!"
    });
});
mongoose
    .connect("mongodb+srv://avalanche:Marvel%40mongodb312@avalanche.w7pqovq.mongodb.net/?retryWrites=true&w=majority", {
        useNewUrlParser: true,
        useUnifiedTopology: true,
        connectTimeoutMS: 30000 // set the connectTimeoutMS option to 30 seconds
    })
    .then(() => console.log("MongoDB connection established..."))
    .catch((error) => console.error("MongoDB connection failed:", error.message));

app.use(`/.netlify/functions/api`, router);
module.exports = app;
module.exports.handler = serverless(app);
