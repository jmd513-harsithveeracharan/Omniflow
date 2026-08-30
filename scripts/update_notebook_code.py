import json
import base64
import subprocess
import requests

def get_token():
    cmd = ["az", "account", "get-access-token", "--resource", "https://api.fabric.microsoft.com", "--query", "accessToken", "-o", "tsv"]
    res = subprocess.run(cmd, capture_output=True, text=True, check=True, shell=True)
    return res.stdout.strip()

def upload_pyspark_code_to_notebook(workspace_id: str, item_id: str, pyspark_code: str):
    token = get_token()
    
    fabric_notebook_content = f"""# FABRIC CELL 1
# MARKDOWN
# # Clean_Sales_Data
# Provisioned automatically by Fabric Autonomous Agent for PBT_DATA_AGENT

# FABRIC CELL 2
# PYSPARK
{pyspark_code}
"""
    b64_code = base64.b64encode(fabric_notebook_content.encode('utf-8')).decode('utf-8')

    payload = {
        "definition": {
            "parts": [
                {
                    "path": "notebook-content.py",
                    "payload": b64_code,
                    "payloadType": "InlineBase64"
                }
            ]
        }
    }

    url = f"https://api.fabric.microsoft.com/v1/workspaces/{workspace_id}/items/{item_id}/updateDefinition"
    headers = {
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json"
    }

    print(f"[HYDRATING NOTEBOOK CODE] Updating definition for Notebook ID {item_id}...")
    res = requests.post(url, headers=headers, json=payload)
    print(f"[API RESPONSE] Status Code: {res.status_code}")
    print(f"[API BODY]: {res.text}")
    return res

if __name__ == "__main__":
    WORKSPACE_ID = "db7344c1-ecd9-44d6-849f-f2de49484f9f"
    NOTEBOOK_ID = "26278688-aaac-47fe-b17a-507ec0c76ae1"
    
    sample_pyspark_code = """from pyspark.sql import SparkSession
from pyspark.sql.functions import col, trim, lower, current_timestamp

# Read sales data from Bronze Layer
df_sales = spark.read.table("lh_stage.bronze_sales")

# Clean & Deduplicate Data
df_clean = df_sales.select(
    col("customer_id"),
    trim(lower(col("customer_name"))).alias("customer_name"),
    col("sales_date"),
    col("sales_amount")
).withColumn("ProcessedAt", current_timestamp())

# Write to Silver Lakehouse Layer
df_clean.write.format("delta").mode("overwrite").saveAsTable("lh_stage.silver_sales")
print("✅ Cleaned sales data successfully written to Silver Lakehouse.")
"""
    
    upload_pyspark_code_to_notebook(WORKSPACE_ID, NOTEBOOK_ID, sample_pyspark_code)
