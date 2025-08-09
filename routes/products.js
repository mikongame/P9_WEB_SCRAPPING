import express from "express";
import Product from "../models/Product.js";

const router = express.Router();

// GET todos los productos
router.get("/", async (req, res) => {
  const products = await Product.find();
  res.json(products);
});

// GET por ID
router.get("/:id", async (req, res) => {
  const product = await Product.findById(req.params.id);
  if (!product) return res.status(404).json({ message: "No encontrado" });
  res.json(product);
});

// POST nuevo producto
router.post("/", async (req, res) => {
  const product = await Product.create(req.body);
  res.status(201).json(product);
});

// PUT editar
router.put("/:id", async (req, res) => {
  const updated = await Product.findByIdAndUpdate(req.params.id, req.body, { new: true });
  res.json(updated);
});

// DELETE
router.delete("/:id", async (req, res) => {
  await Product.findByIdAndDelete(req.params.id);
  res.json({ message: "Producto eliminado" });
});

export default router;
