import express from "express";
import multer from "multer";
import fetch from "node-fetch";
import dotenv from "dotenv";
import fs from "fs";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// Parse JSON & URL-encoded
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Setup multer for file uploads
const upload = multer({ dest: "uploads/" });

// Test route
app.get("/", (req, res) => res.send("Pooch Profile App Running"));

// Form submission
app.post("/submit", upload.single("image"), async (req, res) => {
  try {
    const { pooch_name, breed, birthday, weight, message, customer_id } = req.body;
    const imageFile = req.file;

    if (!imageFile) {
      return res.status(400).json({ error: "Image is required" });
    }

    // Convert image to Base64
    const imageData = fs.readFileSync(imageFile.path, { encoding: "base64" });

    // GraphQL mutation to create metaobject
    const mutation = `
      mutation metaobjectCreate($input: MetaobjectInput!) {
        metaobjectCreate(input: $input) {
          metaobject {
            id
          }
          userErrors {
            field
            message
          }
        }
      }
    `;

    const variables = {
      input: {
        type: "pooch_profile", // Metaobject type handle from Shopify
        fields: [
          { key: "pooch_name", value: pooch_name },
          { key: "breed", value: breed },
          { key: "birthday", value: birthday },
          { key: "weight", value: weight },
          { key: "message", value: message },
          { key: "image", value: imageData },
          { key: "customer_id", value: customer_id }
        ]
      }
    };

    const response = await fetch(`https://${process.env.SHOPIFY_STORE}/admin/api/2025-07/graphql.json`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Shopify-Access-Token": process.env.SHOPIFY_ACCESS_TOKEN,
      },
      body: JSON.stringify({ query: mutation, variables }),
    });

    const result = await response.json();

    // Delete uploaded temp file
    fs.unlinkSync(imageFile.path);

    res.json(result);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Something went wrong" });
  }
});

app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
