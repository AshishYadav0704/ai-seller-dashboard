from fastapi import FastAPI, UploadFile, File, Form, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv
from PIL import Image
from google import genai
from google.genai import types
from typing import List

import sqlite3
import json
import io
import os
import traceback

# ----------------------------
# Load Environment Variables
# ----------------------------
load_dotenv()
API_KEY = os.getenv("GEMINI_API_KEY")

if not API_KEY:
    raise RuntimeError(
        "GEMINI_API_KEY not found.\n"
        "Create a .env file inside backend folder:\n"
        "GEMINI_API_KEY=YOUR_API_KEY"
    )

client = genai.Client(api_key=API_KEY)
print("Gemini API Loaded Successfully")

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ----------------------------
# Database
# ----------------------------
def init_db():
    conn = sqlite3.connect("ecommerce.db")
    cur = conn.cursor()
    cur.execute("""
        CREATE TABLE IF NOT EXISTS products(
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            category TEXT,
            description TEXT,
            status TEXT
        )
    """)
    conn.commit()
    conn.close()

init_db()

CATEGORIES = ["mens footwear", "womens footwear", "electronics", "home appliances", "furniture", "apparel"]

# ----------------------------
# Single Item Routes 
# ----------------------------
@app.post("/analyze-product")
async def analyze_product(file: UploadFile = File(...)):
    try:
        image_bytes = await file.read()
        image = Image.open(io.BytesIO(image_bytes)).convert("RGB")

        prompt = f"""
You are an expert e-commerce product classifier.
Analyze this product image. Choose ONLY ONE category from: {CATEGORIES}
Generate a short SEO friendly description. Return ONLY VALID JSON.
Example: {{"category":"electronics", "description":"Premium wireless headphones."}}
"""
        response = client.models.generate_content(
            model="gemini-2.5-flash",
            contents=[prompt, image],
            config=types.GenerateContentConfig(response_mime_type="application/json")
        )
        clean_text = response.text.strip().removeprefix("```json").removesuffix("```").strip()
        data = json.loads(clean_text)
        return {"category": data["category"], "description": data["description"]}
    except Exception as e:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/save-product")
async def save_product(category: str = Form(...), description: str = Form(...)):
    conn = sqlite3.connect("ecommerce.db")
    cur = conn.cursor()
    cur.execute("INSERT INTO products(category,description,status) VALUES(?,?,?)", (category, description, "published"))
    conn.commit()
    product_id = cur.lastrowid
    conn.close()
    return {"message": "Success", "product_id": product_id}

@app.post("/generate-marketing")
async def generate_marketing(category: str = Form(...), description: str = Form(...)):
    try:
        prompt = f"""
You are an expert digital marketer. I have a product in the category "{category}". The description is: "{description}"
Generate two drafting assets:
1. An engaging Instagram caption with 4-5 relevant hashtags.
2. A short SEO-optimized meta description (under 160 characters).
Return ONLY VALID JSON. Example: {{"instagram_caption": "Caption", "seo_meta": "Meta"}}
"""
        response = client.models.generate_content(
            model="gemini-2.5-flash", contents=[prompt],
            config=types.GenerateContentConfig(response_mime_type="application/json")
        )
        clean_text = response.text.strip().removeprefix("```json").removesuffix("```").strip()
        return json.loads(clean_text)
    except Exception as e:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))

# ----------------------------
# Bulk Item Route (Option 3)
# ----------------------------
@app.post("/bulk-upload")
async def bulk_upload(files: List[UploadFile] = File(...)):
    results = []
    conn = sqlite3.connect("ecommerce.db")
    cur = conn.cursor()

    # Process files sequentially to respect free-tier API rate limits
    for file in files:
        try:
            image_bytes = await file.read()
            image = Image.open(io.BytesIO(image_bytes)).convert("RGB")
            
            prompt = f"""
You are an expert e-commerce product classifier.
Analyze this product image. Choose ONLY ONE category from: {CATEGORIES}
Generate a short SEO friendly description. Return ONLY VALID JSON.
Example: {{"category":"electronics", "description":"Premium wireless headphones."}}
"""
            response = client.models.generate_content(
                model="gemini-2.5-flash",
                contents=[prompt, image],
                config=types.GenerateContentConfig(response_mime_type="application/json")
            )
            clean_text = response.text.strip().removeprefix("```json").removesuffix("```").strip()
            data = json.loads(clean_text)
            
            category = data.get("category", "Error")
            description = data.get("description", "Error parsing description.")
            
            # Instantly insert into database
            cur.execute("INSERT INTO products(category,description,status) VALUES(?,?,?)", (category, description, "published"))
            
            results.append({"filename": file.filename, "status": "Success"})
            
        except Exception as e:
            print(f"Failed processing {file.filename}: {e}")
            results.append({"filename": file.filename, "status": "Error"})
            
    conn.commit()
    conn.close()
    
    return {"processed": len(results), "results": results}

# ----------------------------
# Fetch All Products 
# ----------------------------
@app.get("/products")
async def get_products():
    conn = sqlite3.connect("ecommerce.db")
    conn.row_factory = sqlite3.Row 
    cur = conn.cursor()
    cur.execute("SELECT * FROM products ORDER BY id DESC")
    rows = cur.fetchall()
    conn.close()
    return [dict(row) for row in rows]