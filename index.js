import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { MongoClient, ObjectId, ServerApiVersion } from "mongodb";
import admin from "firebase-admin";
import fs from "fs";

const decoded = Buffer.from(process.env.FB_SERVICE_KEY, "base64").toString("utf8");
const serviceAccount = JSON.parse(decoded);


dotenv.config();

const app = express();


admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

app.use(
  cors({
    origin:[ "http://localhost:5173"," https://propertyhub-b30d3.web.app"],
      methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
    credentials: true,
  })
);
app.use(express.json());

const uri = process.env.MONGODB_URI;
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});


const verifyToken = async (req, res, next) => {
  const token = req.headers.authorization.split(" ")[1];
  try {
    const decoded = await admin.auth().verifyIdToken(token);
    req.token_email = decoded.email;
    next();
  } catch (error) {
    return res.status(401).send("Unauthorized: Invalid token");
  }
};


const run = async () => {
  try {
    await client.connect();
    console.log("Connected to MongoDB");
    const db = client.db("mohammadadeeb886_db_user");
    const usersCollection = db.collection("users");
    const propertiesCollection = db.collection("properties");
    const reviewsCollection = db.collection("reviews");

    app.post("/users", async (req, res) => {
      const { name, email, password, photoURL } = req.body;
      if (!name || !email || !password) {
        return res.status(400).send("Missing required fields");
      }
      const existingUser = await usersCollection.findOne({ email });
      if (existingUser) {
        return res.status(401).send("User already exists");
      }
      const user = await usersCollection.insertOne({
        name,
        email,
        password,
        photoURL,
      });
      res.send(user);
    });

    app.get("/users/:email", async (req, res) => {
      const email = req.params.email;
      const user = await usersCollection.findOne({ email });
      res.send(user);
    });

    app.post("/create-property", verifyToken, async (req, res) => {
      const {
        propertyName,
        price,
        description,
        category,
        imgURL,
        location,
        userEmail,
        userName,
      } = req.body;
      if (
        !propertyName ||
        !price ||
        !description ||
        !category ||
        !imgURL ||
        !location ||
        !userEmail
      ) {
        return res.status(400).send("Missing required fields");
      }
      const existingProperty = await usersCollection.findOne({
        email: userEmail,
      });
      if (!existingProperty) {
        return res.status(401).send("User does not exist");
      }
      const property = await propertiesCollection.insertOne({
        propertyName,
        price,
        description,
        category,
        imgURL,
        location,
        userEmail,
        userName,
        createdAt: new Date(),
      });
      res.status(201).send(property);
    });


    app.put("/properties/update/:propertyId", verifyToken, async (req, res) => {
        const propertyId = req.params.propertyId;
        const { propertyName, price, description, category, imgURL, location, userEmail , userName } = req.body;
        if (!propertyName || !price || !description || !category || !imgURL || !location || !userEmail) {
            return res.status(400).send("Missing required fields");
        }
        const existingProperty = await propertiesCollection.findOne({ _id: new ObjectId(propertyId) });
        if (!existingProperty) {
            return res.status(401).send("Property does not exist");
        }
        const property = await propertiesCollection.updateOne({ _id: new ObjectId(propertyId) }, {
            $set: {
                propertyName,
                price,
                description,
                category,
                imgURL,
                location,
                userEmail,
                userName
            }
        });
        res.status(201).send(property);
    })


    app.get("/properties/:propertyId", async (req, res) => {
      const propertyId = req.params.propertyId;
      
      const property = await propertiesCollection.findOne({ _id: new ObjectId(propertyId) });

      res.send(property);
    });

    app.delete("/properties/:propertyId", verifyToken, async (req, res) => {
      const propertyId = req.params.propertyId;
      const { userEmail } = req.query;
      if (!userEmail) {
        return res.status(400).send("Missing required fields");
      }
      const token_email = req.token_email;
      if (token_email !== userEmail) {
        return res.status(401).send("Unauthorized");
      }
      const existingProperty = await propertiesCollection.findOne({
        _id: new ObjectId(propertyId),
        userEmail,
      });
      if (!existingProperty) {
        return res.status(401).send("Property does not exist");
      }
      await propertiesCollection.deleteOne({ _id: new ObjectId(propertyId) });
      res.send("Property deleted");
    });

    app.get("/my-properties", verifyToken, async (req, res) => {
      const { userEmail } = req.query;
      if (!userEmail) {
        return res.status(400).send("Missing required fields");
      }
      const token_email = req.token_email;
      if (token_email !== userEmail) {
        return res.status(401).send("Unauthorized");
      }
      const userExist = await usersCollection.findOne({ email: userEmail });
      if (!userExist) {
        return res.status(401).send("User does not exist");
      }
      const properties = await propertiesCollection
        .find({ userEmail })
        .toArray();
      res.send(properties);
    });

    app.get("/properties", async (req, res) => {
      const properties = (await propertiesCollection.find().sort( { price: -1 } ).toArray());
      res.send(properties);
    });

    app.get("/featured-properties", async (req, res) => {
      const properties = (await propertiesCollection.find().sort({createdAt: -1}).limit(6).toArray());
      res.send(properties);
    });

    app.post("/review" , verifyToken, async (req, res) => {
      const { propertyId, rating, review , userEmail , reviewrName , propertyIMGURL } = req.body;
      if (!propertyId || !rating || !review || !userEmail) {
        return res.status(400).send("Missing required fields");
      }

      const reviewDoc = await reviewsCollection.insertOne({
        propertyId,
        rating,
        review,
        userEmail,
        reviewrName,
        propertyIMGURL,
        createdAt: new Date(),
      });
      res.status(201).send(reviewDoc);
    });

    app.get("/reviews", verifyToken, async (req, res) => {
      const review = await reviewsCollection.find({ userEmail: req.token_email }).toArray();
      res.status(201).send(review);
    });


  } catch (error) {
    console.log(error);
  }
};

run().catch(console.dir);

app.get("/", (req, res) => {
  res.send("Hello World!");
});

app.listen(process.env.PORT, () => {
  console.log(`Server is running on port ${process.env.PORT}`);
});
