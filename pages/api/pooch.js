import fetch from "node-fetch";

export default async function handler(req, res) {
  // Set CORS headers
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  
  // Handle preflight requests
  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }
  
  // Only allow POST requests
  if (req.method !== "POST") {
    return res.status(405).json({ ok: false, error: "Method not allowed" });
  }

  try {
    // Get the raw body
    const rawBody = await new Promise((resolve) => {
      let data = '';
      req.on('data', chunk => {
        data += chunk;
      });
      req.on('end', () => {
        resolve(Buffer.from(data));
      });
    });

    const contentType = req.headers['content-type'] || '';
    let fields = {};
    let imageFile = null;

    // Check if it's multipart form data (file upload)
    if (contentType.includes('multipart/form-data')) {
      // Parse multipart form data
      const boundary = contentType.split('boundary=')[1];
      const parts = rawBody.toString().split(`--${boundary}`);
      
      for (const part of parts) {
        if (part.includes('filename="')) {
          // This part contains a file
          const filenameMatch = part.match(/filename="([^"]+)"/);
          const nameMatch = part.match(/name="([^"]+)"/);
          const contentTypeMatch = part.match(/Content-Type:\s*([^\r\n]+)/);
          const valueMatch = part.match(/\r\n\r\n([\s\S]*)\r\n$/);
          
          if (filenameMatch && nameMatch && valueMatch) {
            imageFile = {
              fieldName: nameMatch[1],
              filename: filenameMatch[1],
              contentType: contentTypeMatch ? contentTypeMatch[1] : 'application/octet-stream',
              data: Buffer.from(valueMatch[1])
            };
          }
        } else if (part.includes('name="')) {
          // This part contains a regular field
          const nameMatch = part.match(/name="([^"]+)"/);
          const valueMatch = part.match(/\r\n\r\n([\s\S]*)\r\n$/);
          
          if (nameMatch && valueMatch) {
            fields[nameMatch[1]] = valueMatch[1].trim();
          }
        }
      }
    } else {
      // Handle JSON data
      try {
        const jsonData = JSON.parse(rawBody.toString());
        Object.assign(fields, jsonData);
      } catch (e) {
        return res.status(400).json({ ok: false, error: "Invalid JSON data" });
      }
    }

    // Extract fields
    const { name, customer_id, breed, birthday, weight, notes } = fields;
    
    // Validate required fields
    if (!name || !customer_id) {
      return res.status(400).json({ ok: false, error: "Name and customer_id are required" });
    }

    const SHOPIFY_STORE = process.env.SHOPIFY_STORE;
    const SHOPIFY_ACCESS_TOKEN = process.env.SHOPIFY_ACCESS_TOKEN;

    let image_file_gid = null;

    // Handle image upload if present
    if (imageFile) {
      try {
        // Step 1: Create a staged upload target
        const stagedUploadsMutation = `
          mutation stagedUploadsCreate($input: [StagedUploadInput!]!) {
            stagedUploadsCreate(input: $input) {
              stagedTargets {
                url
                resourceUrl
                parameters {
                  name
                  value
                }
              }
              userErrors {
                field
                message
              }
            }
          }
        `;
        
        const stagedUploadVariables = {
          input: [
            {
              resource: "FILE",
              filename: imageFile.filename,
              mimeType: imageFile.contentType,
              fileSize: imageFile.data.length.toString()
            }
          ]
        };
        
        const stagedUploadResponse = await fetch(`https://${SHOPIFY_STORE}/admin/api/2025-10/graphql.json`, {
          method: "POST",
          headers: { 
            "Content-Type": "application/json", 
            "X-Shopify-Access-Token": SHOPIFY_ACCESS_TOKEN 
          },
          body: JSON.stringify({ 
            query: stagedUploadsMutation,
            variables: stagedUploadVariables
          })
        });
        
        const stagedUploadResult = await stagedUploadResponse.json();
        
        if (stagedUploadResult.errors) {
          console.error("Staged upload errors:", stagedUploadResult.errors);
          return res.status(500).json({ ok: false, error: "Failed to create staged upload" });
        }
        
        if (stagedUploadResult.data.stagedUploadsCreate.userErrors.length > 0) {
          console.error("Staged upload user errors:", stagedUploadResult.data.stagedUploadsCreate.userErrors);
          return res.status(400).json({ ok: false, error: stagedUploadResult.data.stagedUploadsCreate.userErrors });
        }
        
        const target = stagedUploadResult.data.stagedUploadsCreate.stagedTargets[0];
        
        // Step 2: Upload the file to the staged target
        const formData = new FormData();
        for (const param of target.parameters) {
          formData.append(param.name, param.value);
        }
        formData.append('file', imageFile.data);
        
        const uploadResponse = await fetch(target.url, {
          method: "POST",
          body: formData
        });
        
        if (!uploadResponse.ok) {
          console.error("File upload failed:", uploadResponse.statusText);
          return res.status(500).json({ ok: false, error: "Failed to upload image" });
        }
        
        // Step 3: Create the file in Shopify
        const fileCreateMutation = `
          mutation fileCreate($files: [FileCreateInput!]!) {
            fileCreate(files: $files) {
              files {
                id
              }
              userErrors {
                field
                message
              }
            }
          }
        `;
        
        const fileCreateVariables = {
          files: [
            {
              alt: name,
              contentType: "IMAGE",
              originalSource: target.resourceUrl
            }
          ]
        };
        
        const fileCreateResponse = await fetch(`https://${SHOPIFY_STORE}/admin/api/2025-10/graphql.json`, {
          method: "POST",
          headers: { 
            "Content-Type": "application/json", 
            "X-Shopify-Access-Token": SHOPIFY_ACCESS_TOKEN 
          },
          body: JSON.stringify({ 
            query: fileCreateMutation,
            variables: fileCreateVariables
          })
        });
        
        const fileCreateResult = await fileCreateResponse.json();
        
        if (fileCreateResult.errors) {
          console.error("File create errors:", fileCreateResult.errors);
          return res.status(500).json({ ok: false, error: fileCreateResult.errors });
        }
        
        if (fileCreateResult.data.fileCreate.userErrors.length > 0) {
          console.error("File create user errors:", fileCreateResult.data.fileCreate.userErrors);
          return res.status(400).json({ ok: false, error: fileCreateResult.data.fileCreate.userErrors });
        }
        
        image_file_gid = fileCreateResult.data.fileCreate.files[0].id;
      } catch (err) {
        console.error("Image upload error:", err);
        return res.status(500).json({ ok: false, error: "Image upload failed: " + err.message });
      }
    }

    // Create the metaobject with the image reference if available
    const metaobjectFields = [
      { key: "name", value: name },
      { key: "breed", value: breed || "" },
      { key: "birthday", value: birthday || "" },
      { key: "weight", value: weight ? weight.toString() : "" },
      { key: "notes", value: notes || "" },
      { key: "customer_id", value: `gid://shopify/Customer/${customer_id}` }
    ];

    if (image_file_gid) {
      metaobjectFields.unshift({ key: "image", value: image_file_gid });
    }

    // Create the metaobject
    const query = `
      mutation {
        metaobjectCreate(
          metaobject: {
            type: "pooch_profile",
            fields: ${JSON.stringify(metaobjectFields).replace(/"([^"]+)":/g, '$1:')}
          }
        ) {
          metaobject { id type fields { key value } }
          userErrors { field message }
        }
      }
    `;

    const response = await fetch(`https://${SHOPIFY_STORE}/admin/api/2025-10/graphql.json`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Shopify-Access-Token": SHOPIFY_ACCESS_TOKEN },
      body: JSON.stringify({ query })
    });

    const result = await response.json();
    
    if (result.errors) {
      console.error("Metaobject creation errors:", result.errors);
      return res.status(500).json({ ok: false, error: result.errors });
    }
    
    if (result.data.metaobjectCreate.userErrors.length > 0) {
      console.error("Metaobject user errors:", result.data.metaobjectCreate.userErrors);
      return res.status(400).json({ ok: false, error: result.data.metaobjectCreate.userErrors });
    }

    res.status(200).json({ ok: true, data: result.data.metaobjectCreate.metaobject });
  } catch (err) {
    console.error("Server error:", err);
    res.status(500).json({ ok: false, error: err.message });
  }
}