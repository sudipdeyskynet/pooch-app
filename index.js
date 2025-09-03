import express from "express";
import multer from "multer";
import fetch from "node-fetch";
import dotenv from "dotenv";
import cors from "cors";

dotenv.config();
const app = express();
const PORT = process.env.PORT || 3000;

// Enable CORS for your Shopify store
app.use(cors({
  origin: "https://thedogsbutcher.myshopify.com", // replace with your Shopify store domain
  methods: ["POST", "GET"]
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const upload = multer({ dest: "uploads/" });

// Test route
app.get("/", (req, res) => res.send("Pooch Profile App Running"));

// Form submission (without image for now)
app.post("/submit", upload.none(), async (req, res) => {
  try {
    const { name, breed, birthday, weight, message, customer_id } = req.body;

    const mutation = `
      mutation metaobjectCreate($input: MetaobjectInput!) {
        metaobjectCreate(input: $input) {
          metaobject { id }
          userErrors { field message }
        }
      }
    `;

    const variables = {
      input: {
        type: "pooch_profile",
        fields: [
          { key: "name", value: name },
          { key: "breed", value: breed },
          { key: "birthday", value: birthday },
          { key: "weight", value: weight },
          { key: "message", value: message },
          { key: "customer_id", value: `gid://shopify/Customer/${customer_id}` }
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
    res.json(result);

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Something went wrong" });
  }
});

app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
