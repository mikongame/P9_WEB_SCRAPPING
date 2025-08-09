import mongoose from "mongoose";
import fs from "fs";
import dotenv from "dotenv";
import Product from "./models/Product.js";

dotenv.config();

const seed = async () => {
  await mongoose.connect(process.env.MONGO_URI);
  await Product.deleteMany();

  const rawData = JSON.parse(fs.readFileSync("products.json"));
  const entries = [];

  for (const category in rawData) {
    for (const item of rawData[category]) {
      entries.push({ ...item, category });
    }
  }

  await Product.insertMany(entries);
  console.log("✅ Productos subidos a MongoDB");
  process.exit();
};

seed();
