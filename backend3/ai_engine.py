import os
import re
import json
from typing import Dict, Any, List, Optional
from pymongo import MongoClient
from dotenv import load_dotenv
import requests

load_dotenv()

MONGO_URIS = [
    os.getenv("MONGO_URI_1"),
    os.getenv("MONGO_URI_2"),
    os.getenv("MONGO_URI_3")
]
MONGO_URIS = [u for u in MONGO_URIS if u]

_mongo_clients = []
for uri in MONGO_URIS:
    try:
        client = MongoClient(uri, serverSelectionTimeoutMS=5000)
        _mongo_clients.append(client)
    except Exception as e:
        print(f"Warning: Failed to connect to MongoDB: {e}")

GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "").strip()
GEMINI_MODEL = os.getenv("GEMINI_MODEL", "gemini-2.5-flash")
GEMINI_URL = f"https://generativelanguage.googleapis.com/v1beta/models/{GEMINI_MODEL}:generateContent"

def get_databases():
    dbs = []
    for c in _mongo_clients:
        try:
            db = c["system_mdm"]
            dbs.append(db)
        except Exception:
            pass
    return dbs

def query_collection(collection_name: str, filter_query: Dict[str, Any], projection: Optional[Dict[str, Any]] = None, limit: int = 50, deduplicate: bool = True) -> List[Dict[str, Any]]:
    results = []
    seen = set()
    for db in get_databases():
        try:
            col = db[collection_name]
            cursor = col.find(filter_query, projection).limit(limit) if projection else col.find(filter_query).limit(limit)
            for d in cursor:
                uid = str(d.get("contractId") or d.get("userId") or d.get("_id"))
                if not deduplicate or uid not in seen:
                    seen.add(uid)
                    d["_id"] = str(d["_id"])
                    results.append(d)
        except Exception as e:
            print(f"Query error on {collection_name}: {e}")
    return results

def count_collection(collection_name: str, filter_query: Dict[str, Any]) -> int:
    total = 0
    for db in get_databases():
        try:
            total += db[collection_name].count_documents(filter_query)
            if total > 0:
                break
        except Exception:
            pass
    return total

class SystemMDAIEngine:
    @staticmethod
    def is_analytical_question(question: str) -> bool:
        analytical_terms = [
            "វិភាគ", "វិភាគឲ្យ", "ប្រៀបធៀប", "និន្នាការ", "ព្យាករណ៍", "ហេតុអ្វី",
            "ណែនាំ", "សង្កេត", "បញ្ហា", "analyze", "analysis", "compare", "trend",
            "forecast", "why", "recommend", "insight", "performance", "anomaly"
        ]
        normalized = question.lower()
        return any(term in normalized for term in analytical_terms)

    @classmethod
    def build_gemini_context(cls, user: Dict[str, Any]) -> Dict[str, Any]:
        contract_filter = cls.build_security_filter(user)
        contracts = query_collection("contracts", contract_filter, limit=100)
        contract_ids = {c.get("contractId") for c in contracts if c.get("contractId")}
        payments = query_collection("payments", {}, limit=500, deduplicate=False)
        if not cls.is_master_admin(user) and user.get("brand"):
            payments = [p for p in payments if p.get("contractId") in contract_ids]

        safe_contracts = [{
            "brand": c.get("brand", ""),
            "status": c.get("status", ""),
            "model": c.get("model", ""),
            "amount": c.get("amount", c.get("totalAmount", 0)),
            "monthlyPayment": c.get("monthlyPayment", 0),
            "lockPhoneStatus": c.get("lockPhoneStatus", "Unlocked"),
            "lockWallpaperStatus": c.get("lockWallpaperStatus", "Unlocked"),
            "inputDate": c.get("inputDate", "")
        } for c in contracts]
        safe_payments = [{
            "amount": p.get("amount", 0),
            "paidDate": p.get("paidDate", p.get("paymentDate", "")),
            "paidBy": p.get("paidBy", p.get("paymentMethod", ""))
        } for p in payments]
        return {
            "scope": "all brands" if cls.is_master_admin(user) else f"brand {user.get('brand', 'restricted')}",
            "contracts": safe_contracts,
            "payments": safe_payments
        }

    @classmethod
    def ask_gemini(cls, question: str, user: Dict[str, Any], conversation_history: Optional[List[Dict[str, str]]] = None) -> Optional[str]:
        if not GEMINI_API_KEY:
            print("Gemini is not configured: GEMINI_API_KEY is missing")
            return None
        context = cls.build_gemini_context(user)
        history = (conversation_history or [])[-6:]
        prompt = (
            "You are the analytical assistant for SYSTEM MDM. Answer in the user's language, "
            "especially Khmer for Khmer questions. Use only the supplied MDM context; never invent values. "
            "Explain calculations briefly and say when the context is insufficient. Never reveal passwords, "
            "secrets, direct customer identifiers, phone numbers, ID cards, IMEI, serial numbers, or database details. "
            f"\nUser role: {user.get('role', 'Staff')}\nQuestion: {question}"
            f"\nRecent conversation: {json.dumps(history, ensure_ascii=False)}"
            f"\nMDM context: {json.dumps(context, ensure_ascii=False, default=str)}"
        )
        try:
            response = requests.post(
                GEMINI_URL,
                params={"key": GEMINI_API_KEY},
                json={
                    "contents": [{"role": "user", "parts": [{"text": prompt}]}],
                    "generationConfig": {"temperature": 0.2, "maxOutputTokens": 700}
                },
                timeout=20
            )
            if not response.ok:
                print(f"Gemini request failed: {response.status_code}: {response.text[:300]}")
                return None
            candidates = response.json().get("candidates", [])
            parts = candidates[0].get("content", {}).get("parts", []) if candidates else []
            answer = "".join(part.get("text", "") for part in parts).strip()
            return answer or None
        except (requests.RequestException, ValueError, KeyError, IndexError) as err:
            print(f"Gemini request error: {err}")
            return None

    @staticmethod
    def is_master_admin(user: Dict[str, Any]) -> bool:
        username = str(user.get("username", "")).lower().strip()
        role = str(user.get("role", "")).lower().strip()
        is_imm = user.get("isImmutable", False)
        return (
            username in ["@hakyonghouv", "hakyonghouv"] or
            "888mdm" in username or
            is_imm is True or
            role == "administrator" or
            role == "superadmin"
        )

    @classmethod
    def build_security_filter(cls, user: Dict[str, Any], extra_filter: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
        query: Dict[str, Any] = extra_filter.copy() if extra_filter else {}
        is_master = cls.is_master_admin(user)
        user_brand = str(user.get("brand", "")).strip()
        allowed_status = str(user.get("allowedStatus", "")).strip()

        # Non-master users are strictly limited to their assigned brand
        if not is_master and user_brand:
            query["brand"] = user_brand

        # If user only has access to specific status
        if allowed_status:
            query["status"] = allowed_status

        return query

    @classmethod
    def check_unauthorized_query(cls, question: str, user: Dict[str, Any]) -> Optional[str]:
        is_master = cls.is_master_admin(user)
        user_brand = user.get("brand", "").strip()
        q_lower = question.lower()

        # Password or secret keys security block
        if any(w in q_lower for w in ["password", "jwt_secret", "encryption_key", "mongo_uri", "ពាក្យសម្ងាត់", "security key", "secondpassword"]):
            return "⚠️ **សុំទោស!** ព័ត៌មានសម្ងាត់ប្រព័ន្ធ (System Passwords & Security Keys) មិនត្រូវបានអនុញ្ញាតឱ្យបង្ហាញ ឬទាញយកឡើយ។"

        # Cross-brand leak block for brand-restricted users
        if not is_master and user_brand:
            other_brand_patterns = ["all brands", "brand ផ្សេង", "គ្រប់ brand", "other brand"]
            if any(p in q_lower for p in other_brand_patterns):
                return f"⚠️ **សុំទោស!** គណនីរបស់អ្នកត្រូវបានកំណត់ឱ្យមើលឃើញតែទិន្នន័យសម្រាប់ Brand **{user_brand}** តែប៉ុណ្ណោះ។ មិនអាចទាញយកទិន្នន័យ Brand ផ្សេងបានទេ។"

        return None

    @classmethod
    def process_chat(cls, question: str, user: Dict[str, Any], conversation_history: Optional[List[Dict[str, str]]] = None) -> str:
        security_violation = cls.check_unauthorized_query(question, user)
        if security_violation:
            return security_violation

        base_filter = cls.build_security_filter(user)
        user_brand = user.get("brand", "")
        user_role = user.get("role", "Staff")
        username = user.get("username", "User")
        name = user.get("name") or username
        is_master = cls.is_master_admin(user)
        
        q = question.strip()
        q_lower = q.lower()

        if cls.is_analytical_question(q):
            gemini_response = cls.ask_gemini(q, user, conversation_history)
            if gemini_response:
                return gemini_response

        # ══════════════════════════════════════════════════════════════
        # 1. USERS & ACCOUNTS QUERIES (គ្រប់ Account, បញ្ជី Users, Profile)
        # ══════════════════════════════════════════════════════════════
        # Case A: Querying ALL accounts / list of accounts
        if any(w in q_lower for w in ["គ្រប់ account", "គ្រប់ គណនី", "all accounts", "list accounts", "list users", "បញ្ជី account", "បញ្ជី users", "បញ្ជីគណនី", "account ទាំងអស់", "users ទាំងអស់", "មាន account អីខ្លះ", "មាន account ណាខ្លះ", "មើល account", "information គ្រប់ account"]):
            user_filter = {} if is_master else {"brand": user_brand}
            users_list = query_collection("users", user_filter, {"password": 0, "secondPassword": 0}, limit=30)
            
            if not users_list:
                return f"ℹ️ មិនទាន់មានគណនី (Accounts) ក្នុង Brand **{user_brand if user_brand else 'ប្រព័ន្ធ'}** នៅឡើយទេ។"

            scope_title = "ទូទាំងប្រព័ន្ធ (All Brands)" if is_master else f"សម្រាប់ Brand **{user_brand}**"
            res = f"### 👥 បញ្ជីគណនីអ្នកប្រើប្រាស់ {scope_title} (សរុប `{len(users_list)}` គណនី):\n\n"
            res += "| ល.រ | ឈ្មោះពេញ (Name) | Username | តួនាទី (Role) | ម៉ាក (Brand) | ស្ថានភាព |\n"
            res += "| :---: | :--- | :--- | :--- | :--- | :--- |\n"
            for idx, u in enumerate(users_list, 1):
                u_name = u.get("name", "—")
                u_user = u.get("username", "—")
                u_role = u.get("role", "Staff")
                u_brand = u.get("brand") or "Global"
                u_status = u.get("status", "Offline")
                status_badge = "🟢 Online" if u_status == "Online" else "⚪ Offline"
                res += f"| {idx} | **{u_name}** | `{u_user}` | {u_role} | **{u_brand}** | {status_badge} |\n"
            
            res += "\n> 💡 *លោកអ្នកអាចសួរឈ្មោះ Username ជាក់លាក់ ដើម្បីមើលព័ត៌មានលម្អិតបន្ថែម!*"
            return res

        # Case B: Querying MY account info / profile
        if any(w in q_lower for w in ["account ខ្ញុំ", "information account ខ្ញុំ", "account info", "profile", "my account", "user info", "តួនាទីខ្ញុំ", "សិទ្ធិខ្ញុំ", "who am i", "គណនីខ្ញុំ", "ព័ត៌មានគណនី"]):
            db_users = query_collection("users", {"username": username}, {"password": 0, "secondPassword": 0}, limit=1)
            created_at = "—"
            user_phone = "—"
            user_email = "—"
            if db_users:
                u = db_users[0]
                created_at = str(u.get("createdAt", "—"))[:10]
                user_phone = u.get("phone", "—")
                user_email = u.get("email", "—")

            scope_desc = "ចូលមើលបានគ្រប់ Brands និងទិន្នន័យទូទាំងប្រព័ន្ធ (Full Master Access)" if is_master else f"គ្រប់គ្រងទិន្នន័យសម្រាប់តែ Brand **{user_brand}** ប៉ុណ្ណោះ"

            res = f"### 👤 ព័ត៌មានលម្អិតអំពីគណនីរបស់អ្នក (Account Information)\n\n"
            res += f"* **ឈ្មោះពេញ (Full Name)**: **{name}**\n"
            res += f"* **Username**: `{username}`\n"
            res += f"* **តួនាទី (Role)**: **{user_role}**\n"
            res += f"* **ម៉ាកដែលគ្រប់គ្រង (Brand)**: **{user_brand if user_brand else 'ទូទាំងប្រព័ន្ធ (Global)'}**\n"
            res += f"* **Email**: `{user_email}`\n"
            res += f"* **លេខទូរស័ព្ទ (Phone)**: `{user_phone}`\n"
            res += f"* **ថ្ងៃបង្កើត (Created At)**: `{created_at}`\n"
            res += f"* **ស្ថានភាព (Status)**: `Active / Verified` 🟢\n"
            res += f"* **ដែនកំណត់ទិន្នន័យ (Access Scope)**: {scope_desc}\n\n"
            res += "> 🔒 *គណនីរបស់អ្នកមានសុវត្ថិភាពខ្ពស់ និងភ្ជាប់ជាមួយប្រព័ន្ធ MDM Control System រួចរាល់!*"
            return res

        # ══════════════════════════════════════════════════════════════
        # 2. GREETINGS & CAPABILITIES
        # ══════════════════════════════════════════════════════════════
        if any(w in q_lower for w in ["សួស្តី", "hello", "hi", "ជម្រាបសួរ", "good morning", "good afternoon", "តើឯងជាអ្វី", "ជួយអ្វីបានខ្លះ", "help", "មុខងារ", "how to use"]):
            brand_text = f"សម្រាប់ Brand **{user_brand}**" if user_brand and not is_master else "ទូទាំងប្រព័ន្ធ"
            res = f"👋 **សួស្តី {name}!** ខ្ញុំជា **MDM Smart AI Assistant** ជំនួយការឆ្លាតវៃប្រព័ន្ធ MDM។\n\n"
            res += f"ខ្ញុំត្រូវបានភ្ជាប់ផ្ទាល់ជាមួយ MongoDB {brand_text} ដើម្បីជួយលោកអ្នកក្នុងការ៖\n\n"
            res += f"* 👥 **គ្រប់គ្រងគណនី**: សួរ `គ្រប់ account`, `account ខ្ញុំ`, ឬ `បញ្ជី users`\n"
            res += f"* 🔍 **ស្វែងរកកិច្ចសន្យា & អតិថិជន**: សួរឈ្មោះ, លេខទូរស័ព្ទ, ឬ ID Card\n"
            res += f"* 📱 **ស្វែងរកទូរស័ព្ទ**: សួរតាម Model, IMEI, MEID, ឬ Serial Number\n"
            res += f"* 💳 **ពិនិត្យការបង់ប្រាក់**: មើលប្រវត្តិបង់ប្រាក់, ចំនួនលុយបានបង់, និងប្រាក់នៅសល់\n"
            res += f"* 🔒 **ពិនិត្យ Security Lock**: មើលទូរស័ព្ទជាប់ Phone Lock ឬ Wallpaper Lock\n"
            res += f"* 📊 **សង្ខេបទិន្នន័យ**: ធ្វើរបាយការណ៍សរុបកិច្ចសន្យា ឧបករណ៍សកម្ម និងចំនួនលុយប្រមូលបាន\n\n"
            res += f"> 💡 *លោកអ្នកអាចសាកល្បងសួរដោយផ្ទាល់ ឧទាហរណ៍៖ `គ្រប់ account` ឬ `សង្ខេបទិន្នន័យ`!*"
            return res

        # ══════════════════════════════════════════════════════════════
        # 3. LIST ALL CUSTOMERS / CONTRACTS
        # ══════════════════════════════════════════════════════════════
        if any(w in q_lower for w in ["customer ទាំងអស់", "បញ្ជីអតិថិជន", "កិច្ចសន្យាទាំងអស់", "all customers", "list customers", "list contracts", "បង្ហាញអតិថិជន", "កិច្ចសន្យា"]):
            contracts = query_collection("contracts", base_filter, limit=15)
            if not contracts:
                return f"ℹ️ មិនទាន់មានកិច្ចសន្យាណាមួយក្នុងទិន្នន័យ {user_brand if user_brand else 'ប្រព័ន្ធ'} នៅឡើយទេ។"
            
            res = f"### 📋 បញ្ជីកិច្ចសន្យាអតិថិជន ({len(contracts)} ឯកសារ):\n\n"
            res += "| ល.រ | ឈ្មោះអតិថិជន | ម៉ូឌែលទូរស័ព្ទ | Serial Number | លេខទូរស័ព្ទ | ស្ថានភាព |\n"
            res += "| :---: | :--- | :--- | :--- | :--- | :--- |\n"
            for idx, c in enumerate(contracts, 1):
                n = f"{c.get('customerNameEn', '—')} ({c.get('customerNameKh', '—')})"
                m = c.get("model", "—")
                s = c.get("serialNumber", "—")
                p = c.get("phone", "—")
                st = c.get("status", "—")
                res += f"| {idx} | **{n}** | {m} | `{s}` | `{p}` | `{st}` |\n"
            res += "\n> 💡 *លោកអ្នកអាចសួរឈ្មោះ ឬ Serial Number ជាក់លាក់ ដើម្បីមើលព័ត៌មានលម្អិត!*"
            return res

        # ══════════════════════════════════════════════════════════════
        # 4. LIST ALL DEVICES
        # ══════════════════════════════════════════════════════════════
        if any(w in q_lower for w in ["ទូរស័ព្ទទាំងអស់", "បញ្ជីទូរស័ព្ទ", "ឧបករណ៍ទាំងអស់", "all devices", "list devices", "device ទាំងអស់"]):
            contracts = query_collection("contracts", base_filter, limit=15)
            if not contracts:
                return f"ℹ️ មិនទាន់មានឧបករណ៍ទូរស័ព្ទណាមួយក្នុងទិន្នន័យ {user_brand if user_brand else 'ប្រព័ន្ធ'} នៅឡើយទេ។"
            
            res = f"### 📱 បញ្ជីឧបករណ៍ទូរស័ព្ទក្នុងប្រព័ន្ធ ({len(contracts)} គ្រឿង):\n\n"
            res += "| ល.រ | ម៉ូឌែល (Model) | Serial Number | IMEI 1 | MEID | Phone Lock |\n"
            res += "| :---: | :--- | :--- | :--- | :--- | :--- |\n"
            for idx, c in enumerate(contracts, 1):
                m = c.get("model", "—")
                s = c.get("serialNumber", "—")
                imei = c.get("imei1", "—")
                meid = c.get("meid", "—")
                l = c.get("lockPhoneStatus", "Unlocked")
                res += f"| {idx} | **{m}** | `{s}` | `{imei}` | `{meid}` | `{l}` |\n"
            return res

        # ══════════════════════════════════════════════════════════════
        # 5. SUMMARY / STATISTICS OVERVIEW
        # ══════════════════════════════════════════════════════════════
        if any(w in q_lower for w in ["statistic", "summary", "សង្ខេប", "ប៉ុន្មាន", "ចំនួនសរុប", "របាយការណ៍", "total", "overview", "how many"]) and not any(k in q_lower for k in ["imei", "serial", "meid"]) and len(q) < 80:
            total_contracts = count_collection("contracts", base_filter)
            activated_filter = {**base_filter, "status": "Activated"}
            total_activated = count_collection("contracts", activated_filter)
            locked_filter = {**base_filter, "lockPhoneStatus": "Locked"}
            total_locked = count_collection("contracts", locked_filter)
            wallpaper_locked_filter = {**base_filter, "lockWallpaperStatus": "Locked"}
            total_wp_locked = count_collection("contracts", wallpaper_locked_filter)

            payments = query_collection("payments", {}, limit=500)
            if not is_master and user_brand:
                matched_contracts = query_collection("contracts", base_filter, limit=500)
                matched_ids = set(c.get("contractId") for c in matched_contracts if c.get("contractId"))
                payments = [p for p in payments if p.get("contractId") in matched_ids]

            total_paid_amount = sum(float(p.get("amount", 0) or 0) for p in payments)

            brand_label = f"សម្រាប់ Brand **{user_brand}**" if user_brand and not is_master else "ទូទាំងប្រព័ន្ធ (All Brands)"

            response = f"### 📊 របាយការណ៍សង្ខេបទិន្នន័យ {brand_label}\n\n"
            response += f"* **កិច្ចសន្យាសរុប (Total Contracts)**: `{total_contracts}` ឯកសារ\n"
            response += f"* **ឧបករណ៍សកម្ម (Activated Devices)**: `{total_activated}` គ្រឿង\n"
            response += f"* **ទូរស័ព្ទជាប់ Phone Lock**: `{total_locked}` គ្រឿង\n"
            response += f"* **ទូរស័ព្ទជាប់ Wallpaper Lock**: `{total_wp_locked}` គ្រឿង\n"
            response += f"* **ប្រាក់ទទួលបានសរុបពីការបង់ (Total Collected)**: `${total_paid_amount:,.2f}`\n\n"
            response += "> 💡 *លោកអ្នកអាចសួរលម្អិតអំពីអតិថិជនជាក់លាក់ តាមរយៈឈ្មោះ, លេខទូរស័ព្ទ, Serial Number ឬ IMEI!*"
            return response

        # ══════════════════════════════════════════════════════════════
        # 6. SEARCH CONTRACTS / USERS / PAYMENTS BY KEYWORD
        # ══════════════════════════════════════════════════════════════
        clean_kw = re.sub(
            r"(ជួយបង្ហាញពី|ជួយបង្ហាញ|បង្ហាញពី|បង្ហាញ|ស្វែងរក|រកមើល|រក|មើល|តើ|មាន|ឈ្មោះ|លេខ|ទូរស័ព្ទ|តិចមក|បន្តិចមក|មក|ផង|ព័ត៌មាន|serial|imei|meid|search|find|show|info|details|about|customer|device|please|give me)",
            "",
            q,
            flags=re.IGNORECASE
        ).strip()

        search_kw = clean_kw if len(clean_kw) >= 2 else q

        regex_pattern = {"$regex": re.escape(search_kw), "$options": "i"}

        # Check users collection for specific username or name query
        matched_users = query_collection("users", {
            "$or": [
                {"username": regex_pattern},
                {"name": regex_pattern},
                {"email": regex_pattern}
            ]
        }, {"password": 0, "secondPassword": 0}, limit=5)

        if matched_users:
            if not is_master and user_brand:
                matched_users = [u for u in matched_users if u.get("brand") == user_brand]

            if matched_users:
                res = f"### 👤 រកឃើញគណនីចំនួន `{len(matched_users)}` ដែលត្រូវនឹង **\"{search_kw}\"**:\n\n"
                res += "| ឈ្មោះ (Name) | Username | តួនាទី (Role) | Brand | Status |\n"
                res += "| :--- | :--- | :--- | :--- | :--- |\n"
                for u in matched_users:
                    st = "🟢 Online" if u.get("status") == "Online" else "⚪ Offline"
                    res += f"| **{u.get('name', '—')}** | `{u.get('username', '—')}` | {u.get('role', '—')} | **{u.get('brand', 'Global')}** | {st} |\n"
                return res

        # Search Contracts
        or_conditions = [
            {"customerNameEn": regex_pattern},
            {"customerNameKh": regex_pattern},
            {"phone": regex_pattern},
            {"relativePhone": regex_pattern},
            {"idCardNumber": regex_pattern},
            {"serialNumber": regex_pattern},
            {"imei1": regex_pattern},
            {"imei2": regex_pattern},
            {"meid": regex_pattern},
            {"model": regex_pattern},
            {"contractId": regex_pattern}
        ]

        search_filter = {
            **base_filter,
            "$or": or_conditions
        }

        matched_contracts = query_collection("contracts", search_filter, limit=10)

        # If not found with keyword, search payments
        matched_payments = []
        if not matched_contracts:
            matched_payments = query_collection("payments", {"$or": [{"customerName": regex_pattern}, {"serialNumber": regex_pattern}, {"contractId": regex_pattern}]}, limit=10)
            if not is_master and user_brand:
                brand_contracts = query_collection("contracts", base_filter, limit=500)
                brand_ids = set(c.get("contractId") for c in brand_contracts)
                matched_payments = [p for p in matched_payments if p.get("contractId") in brand_ids]

        # ── 7. Format Matched Contract Results ──
        if matched_contracts:
            if len(matched_contracts) == 1:
                c = matched_contracts[0]
                contract_id = c.get("contractId", "—")
                c_name_en = c.get("customerNameEn", "—")
                c_name_kh = c.get("customerNameKh", "—")
                phone = c.get("phone", "—")
                id_card = c.get("idCardNumber", "—")
                model = c.get("model", "—")
                serial = c.get("serialNumber", "—")
                imei1 = c.get("imei1", "—")
                imei2 = c.get("imei2", "—")
                meid = c.get("meid", "—")
                brand = c.get("brand", "—")
                status = c.get("status", "Application")
                total_amt = float(c.get("amount", 0) or c.get("totalAmount", 0) or 0)
                monthly = float(c.get("monthlyPayment", 0) or 0)
                phone_lock = c.get("lockPhoneStatus", "Unlocked")
                wp_lock = c.get("lockWallpaperStatus", "Unlocked")
                cur_addr = c.get("currentAddress", "—")

                payments = query_collection("payments", {"contractId": contract_id}, limit=50)
                total_paid = sum(float(p.get("amount", 0) or 0) for p in payments)
                remaining = max(0, total_amt - total_paid)

                res = f"### 👤 ព័ត៌មានលម្អិតអតិថិជន: **{c_name_en}** ({c_name_kh})\n\n"
                res += f"**🪪 ព័ត៌មានផ្ទាល់ខ្លួន (Personal Info)**:\n"
                res += f"* **លេខអត្តសញ្ញាណប័ណ្ណ (ID Card)**: `{id_card}`\n"
                res += f"* **លេខទូរស័ព្ទ (Phone)**: `{phone}`\n"
                res += f"* **អាសយដ្ឋានបច្ចុប្បន្ន (Address)**: {cur_addr}\n"
                res += f"* **កិច្ចសន្យា (Contract ID)**: `{contract_id}` | ម៉ាក (Brand): **{brand}** | ស្ថានភាព: **{status}**\n\n"

                res += f"**📱 ព័ត៌មានទូរស័ព្ទ (Device Info)**:\n"
                res += f"* **ម៉ូឌែល (Model)**: **{model}**\n"
                res += f"* **Serial Number**: `{serial}`\n"
                res += f"* **IMEI 1**: `{imei1}` | **IMEI 2**: `{imei2}`\n"
                if meid and meid != "—":
                    res += f"* **MEID**: `{meid}`\n"
                res += f"* **ស្ថានភាព Lock**: Phone Lock: `{phone_lock}` | Wallpaper Lock: `{wp_lock}`\n\n"

                res += f"**💰 ព័ត៌មានហិរញ្ញវត្ថុ និងការបង់ប្រាក់ (Payment Overview)**:\n"
                res += f"* **តម្លៃកម្ចីសរុប (Total Loan)**: `${total_amt:,.2f}`\n"
                res += f"* **បង់ប្រចាំខែ (Monthly)**: `${monthly:,.2f}/ខែ`\n"
                res += f"* **បានបង់សរុប (Total Paid)**: `${total_paid:,.2f}` ({len(payments)} លើក)\n"
                res += f"* **ប្រាក់នៅសល់ (Remaining)**: `${remaining:,.2f}`\n"

                if payments:
                    res += "\n**🧾 ប្រវត្តិបង់ប្រាក់ចុងក្រោយ (Recent Payments)**:\n"
                    res += "| កាលបរិច្ឆេទ | ចំនួនទឹកប្រាក់ | វគ្គខែ | វិធីសាស្ត្រ |\n"
                    res += "| :--- | :--- | :--- | :--- |\n"
                    for p in payments[:5]:
                        dt = p.get("paymentDate", "—") or str(p.get("createdAt", "—"))[:10]
                        amt = f"${float(p.get('amount', 0)):,.2f}"
                        mth = p.get("month", "Installment")
                        mtd = p.get("paymentMethod", "Cash / ABA")
                        res += f"| {dt} | {amt} | {mth} | {mtd} |\n"

                return res

            else:
                res = f"### 🔍 រកឃើញកិច្ចសន្យាចំនួន `{len(matched_contracts)}` ដែលត្រូវនឹងសំណួររបស់អ្នក:\n\n"
                res += "| ល.រ | ឈ្មោះអតិថិជន | ម៉ូឌែលទូរស័ព្ទ | Serial Number | លេខទូរស័ព្ទ | ស្ថានភាព |\n"
                res += "| :---: | :--- | :--- | :--- | :--- | :--- |\n"
                for idx, c in enumerate(matched_contracts, 1):
                    n = f"{c.get('customerNameEn', '—')} ({c.get('customerNameKh', '—')})"
                    m = c.get("model", "—")
                    s = c.get("serialNumber", "—")
                    p = c.get("phone", "—")
                    st = c.get("status", "—")
                    res += f"| {idx} | **{n}** | {m} | `{s}` | `{p}` | `{st}` |\n"
                res += "\n> 💡 *សូមបញ្ជាក់ឈ្មោះ ឬ Serial Number ឱ្យកាន់តែច្បាស់ ប្រសិនបើចង់មើលព័ត៌មានលម្អិតជាក់លាក់ណាមួយ!*"
                return res

        # ── 8. Format Matched Payments ──
        if matched_payments:
            res = f"### 💳 រកឃើញប្រវត្តិប្រតិបត្តិការបង់ប្រាក់ចំនួន `{len(matched_payments)}` លើក:\n\n"
            res += "| កាលបរិច្ឆេទ | អតិថិជន | Serial Number | ចំនួនទឹកប្រាក់ | វគ្គខែ |\n"
            res += "| :--- | :--- | :--- | :--- | :--- |\n"
            for p in matched_payments:
                dt = p.get("paymentDate", "—") or str(p.get("createdAt", "—"))[:10]
                cn = p.get("customerName", "—")
                sn = p.get("serialNumber", "—")
                amt = f"${float(p.get('amount', 0)):,.2f}"
                mth = p.get("month", "Installment")
                res += f"| {dt} | **{cn}** | `{sn}` | `{amt}` | {mth} |\n"
            return res

        gemini_response = cls.ask_gemini(q, user, conversation_history)
        if gemini_response:
            return gemini_response

        # ── 9. Smart Fallback with Actionable Prompts ──
        brand_info = f"Brand **{user_brand}**" if user_brand and not is_master else "ទូទាំងប្រព័ន្ធ"
        return (
            f"🤖 **MDM AI Assistant**:\n\n"
            f"ខ្ញុំបានស្វែងរកក្នុងទិន្នន័យ {brand_info} ប៉ុន្តែមិនទាន់រកឃើញទិន្នន័យដែលត្រូវនឹង **\"{q}\"** នោះទេ។\n\n"
            f"លោកអ្នកអាចសាកល្បងសួរខ្ញុំអំពី៖\n"
            f"* 👥 **គណនីអ្នកប្រើប្រាស់**: សួរ `គ្រប់ account`, `បញ្ជី users`, ឬ `account ខ្ញុំ`\n"
            f"* 📋 **បញ្ជីអតិថិជន**: សួរ `បង្ហាញបញ្ជីអតិថិជន` ឬ `កិច្ចសន្យាទាំងអស់`\n"
            f"* 🔍 **ស្វែងរកតាមឈ្មោះ**: សួរ `រកឈ្មោះ Chet Vandeth`\n"
            f"* 📱 **ស្វែងរកតាម IMEI / MEID / Serial**: សួរ `IMEI 351732277360759`\n"
            f"* 📊 **សង្ខេបទិន្នន័យ**: សួរ `សង្ខេបទិន្នន័យ` ឬ `របាយការណ៍`\n"
            f"* 🔒 **ពិនិត្យ Lock**: សួរ `តើមានទូរស័ព្ទប៉ុន្មានគ្រឿងដែលជាប់ Lock?`\n"
        )
