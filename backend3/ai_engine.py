import os
import re
from typing import Dict, Any, List, Optional
from pymongo import MongoClient
from dotenv import load_dotenv

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

def get_databases():
    dbs = []
    for c in _mongo_clients:
        try:
            dbs.append(c.get_default_database() or c["system_mdm"])
        except Exception:
            pass
    return dbs

def query_collection(collection_name: str, filter_query: Dict[str, Any], limit: int = 50) -> List[Dict[str, Any]]:
    results = []
    seen = set()
    for db in get_databases():
        try:
            col = db[collection_name]
            docs = list(col.find(filter_query).limit(limit))
            for d in docs:
                uid = str(d.get("contractId") or d.get("_id"))
                if uid not in seen:
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
    def is_master_admin(user: Dict[str, Any]) -> bool:
        username = str(user.get("username", "")).lower().strip()
        role = str(user.get("role", "")).strip()
        is_imm = user.get("isImmutable", False)
        return (
            username in ["@hakyonghouv", "hakyonghouv"] or
            is_imm is True or
            role == "Administrator"
        )

    @classmethod
    def build_security_filter(cls, user: Dict[str, Any], extra_filter: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
        query: Dict[str, Any] = extra_filter.copy() if extra_filter else {}
        is_master = cls.is_master_admin(user)
        user_brand = user.get("brand", "").strip()
        allowed_status = user.get("allowedStatus", "").strip()

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

        if any(w in q_lower for w in ["password", "jwt_secret", "encryption_key", "mongo_uri", "ពាក្យសម្ងាត់", "security key"]):
            return "⚠️ **សុំទោស!** ព័ត៌មានសម្ងាត់ប្រព័ន្ធ (System Security Keys & Passwords) មិនត្រូវបានអនុញ្ញាតឱ្យបង្ហាញ ឬទាញយកឡើយ។"

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
        permissions = user.get("permissions", [])
        
        q = question.strip()
        q_lower = q.lower()

        # ── 1. User Profile & Account Info Query ──
        if any(w in q_lower for w in ["account ខ្ញុំ", "information account", "account info", "profile", "my account", "user info", "តួនាទីខ្ញុំ", "សិទ្ធិខ្ញុំ", "who am i", "គណនីខ្ញុំ", "ព័ត៌មានគណនី"]):
            db_users = query_collection("users", {"username": username}, limit=1)
            created_at = "—"
            user_phone = "—"
            if db_users:
                u = db_users[0]
                created_at = str(u.get("createdAt", "—"))[:10]
                user_phone = u.get("phone", "—")

            perm_count = len(permissions) if isinstance(permissions, list) else "Full"
            scope_desc = "ចូលមើលបានគ្រប់ Brands និងទិន្នន័យទូទាំងប្រព័ន្ធ (Full Master Access)" if is_master else f"គ្រប់គ្រងទិន្នន័យសម្រាប់តែ Brand **{user_brand}** ប៉ុណ្ណោះ"

            res = f"### 👤 ព័ត៌មានលម្អិតអំពីគណនីរបស់អ្នក (Account Information)\n\n"
            res += f"* **ឈ្មោះពេញ (Full Name)**: **{name}**\n"
            res += f"* **Username**: `{username}`\n"
            res += f"* **តួនាទី (Role)**: **{user_role}**\n"
            res += f"* **ម៉ាកដែលគ្រប់គ្រង (Brand)**: **{user_brand if user_brand else 'ទូទាំងប្រព័ន្ធ (Global)'}**\n"
            res += f"* **លេខទូរស័ព្ទ (Phone)**: `{user_phone}`\n"
            res += f"* **ថ្ងៃបង្កើតគណនី (Created At)**: `{created_at}`\n"
            res += f"* **ស្ថានភាព (Status)**: `Active / Verified` 🟢\n"
            res += f"* **ដែនកំណត់ទិន្នន័យ (Access Scope)**: {scope_desc}\n"
            if permissions and not is_master:
                res += f"* **ទំព័រដែលទទួលបានសិទ្ធិ (Allowed Pages)**: `{perm_count}` ផ្នែក\n"
            res += "\n> 🔒 *គណនីរបស់អ្នកមានសុវត្ថិភាពខ្ពស់ និងភ្ជាប់ជាមួយប្រព័ន្ធ MDM Control System រួចរាល់!*"
            return res

        # ── 2. Greetings & System Capabilities ──
        if any(w in q_lower for w in ["សួស្តី", "hello", "hi", "ជម្រាបសួរ", "good morning", "good afternoon", "តើឯងជាអ្វី", "ជួយអ្វីបានខ្លះ", "help", "មុខងារ"]):
            brand_text = f"សម្រាប់ Brand **{user_brand}**" if user_brand and not is_master else "ទូទាំងប្រព័ន្ធ"
            res = f"👋 **សួស្តី {name}!** ខ្ញុំជា **MDM Smart AI Assistant** ជំនួយការឆ្លាតវៃប្រព័ន្ធ MDM។\n\n"
            res += f"ខ្ញុំត្រូវបានភ្ជាប់ផ្ទាល់ជាមួយ MongoDB {brand_text} ដើម្បីជួយលោកអ្នកក្នុងការ៖\n\n"
            res += f"* 🔍 **ស្វែងរកកិច្ចសន្យា & អតិថិជន**: សួរឈ្មោះ, លេខទូរស័ព្ទ, ឬ ID Card\n"
            res += f"* 📱 **ស្វែងរកទូរស័ព្ទ**: សួរតាម Model, IMEI, MEID, ឬ Serial Number\n"
            res += f"* 💳 **ពិនិត្យការបង់ប្រាក់**: មើលប្រវត្តិបង់ប្រាក់, ចំនួនលុយបានបង់, និងប្រាក់នៅសល់\n"
            res += f"* 🔒 **ពិនិត្យ Security Lock**: មើលស្ថានភាពទូរស័ព្ទជាប់ Phone Lock ឬ Wallpaper Lock\n"
            res += f"* 📊 **សង្ខេបទិន្នន័យ**: ធ្វើរបាយការណ៍សរុបកិច្ចសន្យា ឧបករណ៍សកម្ម និងចំនួនលុយប្រមូលបាន\n\n"
            res += f"> 💡 *លោកអ្នកអាចសាកល្បងសួរដោយផ្ទាល់ ឧទាហរណ៍៖ `សង្ខេបទិន្នន័យ` ឬ `រកឈ្មោះ Chet Vandeth`!*"
            return res

        # ── 3. List All Customers / Contracts Query ──
        if any(w in q_lower for w in ["customer ទាំងអស់", "បញ្ជីអតិថិជន", "កិច្ចសន្យាទាំងអស់", "all customers", "list customers", "list contracts", "កិច្ចសន្យា", "បង្ហាញអតិថិជន"]):
            contracts = query_collection("contracts", base_filter, limit=15)
            if not contracts:
                return f"ℹ️ មិនទាន់មានកិច្ចសន្យាណាមួយក្នុងទិន្នន័យ {user_brand if user_brand else 'ប្រព័ន្ធ'} នៅឡើយទេ។"
            
            res = f"### 📋 បញ្ជីកិច្ចសន្យាអតិថិជនចុងក្រោយ ({len(contracts)} ឯកសារ):\n\n"
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

        # ── 4. List All Devices Query ──
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

        # ── 5. Summary / Statistics Query ──
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

        # ── 6. Search by Keyword (Name, Phone, ID card, Serial, IMEI, MEID, Model) ──
        # Strip conversational filler words in Khmer & English
        clean_kw = re.sub(
            r"(ជួយបង្ហាញពី|ជួយបង្ហាញ|បង្ហាញពី|បង្ហាញ|ស្វែងរក|រកមើល|រក|មើល|តើ|មាន|ឈ្មោះ|លេខ|ទូរស័ព្ទ|តិចមក|បន្តិចមក|មក|ផង|ព័ត៌មាន|serial|imei|meid|search|find|show|info|details|about|customer|device|please|give me)",
            "",
            q,
            flags=re.IGNORECASE
        ).strip()

        search_kw = clean_kw if len(clean_kw) >= 2 else q

        regex_pattern = {"$regex": re.escape(search_kw), "$options": "i"}
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

        # ── 9. General Natural Guidance Response ──
        brand_info = f"Brand **{user_brand}**" if user_brand and not is_master else "ទូទាំងប្រព័ន្ធ"
        return (
            f"🤖 **MDM AI Assistant**:\n\n"
            f"ខ្ញុំបានស្វែងរកក្នុងទិន្នន័យ {brand_info} ប៉ុន្តែមិនទាន់រកឃើញទិន្នន័យដែលត្រូវនឹង **\"{q}\"** នោះទេ។\n\n"
            f"លោកអ្នកអាចសាកល្បងសួរខ្ញុំអំពី៖\n"
            f"* 👤 **ព័ត៌មានគណនី**: ឧទាហរណ៍ `account ខ្ញុំ` ឬ `តួនាទីរបស់ខ្ញុំ`\n"
            f"* 📋 **បញ្ជីអតិថិជន**: ឧទាហរណ៍ `បង្ហាញបញ្ជីអតិថិជន` ឬ `កិច្ចសន្យាទាំងអស់`\n"
            f"* 🔍 **ស្វែងរកតាមឈ្មោះ**: ឧទាហរណ៍ `រកឈ្មោះ Chet Vandeth`\n"
            f"* 📱 **ស្វែងរកតាមលេខទូរស័ព្ទ / IMEI / MEID / Serial**: ឧទាហរណ៍ `IMEI 351732277360759`\n"
            f"* 📊 **សង្ខេបទិន្នន័យ & របាយការណ៍**: ឧទាហរណ៍ `សង្ខេបទិន្នន័យ` ឬ `របាយការណ៍`\n"
            f"* 🔒 **ពិនិត្យ Lock**: ឧទាហរណ៍ `តើមានទូរស័ព្ទប៉ុន្មានគ្រឿងដែលជាប់ Lock?`\n"
        )
