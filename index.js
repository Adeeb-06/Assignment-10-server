import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { MongoClient, ServerApiVersion } from "mongodb";

dotenv.config();

const app = express();

app.use(cors({
    origin: "http://localhost:5173",
}));
app.use(express.json());

const uri  = process.env.MONGODB_URI;
const client = new MongoClient(uri, {
    serverApi: {
        version: ServerApiVersion.v1,
        strict: true,
        deprecationErrors: true,
    }
    });


const run = async () => {
    try{
        await client.connect();
        console.log("Connected to MongoDB");
        const db = client.db("mohammadadeeb886_db_user");
        const usersCollection = db.collection("users");

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
        

    } catch (error) {
        console.log(error);
    }
}

run().catch(console.dir);

app.get("/", (req, res) => {
  res.send("Hello World!");
});

app.listen(process.env.PORT, () => {
  console.log(`Server is running on port ${process.env.PORT}`);
});