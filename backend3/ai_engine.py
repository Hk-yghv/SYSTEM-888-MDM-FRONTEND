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
        is_master = cls.is_master_admin(user)
        q = question.strip()
        q_lower = q.lower()

        # ── (A) Summary / Statistics Query ──
        if any(w in q_lower for w in ["statistic", "summary", "សង្ខេប", "ប៉ុន្មាន", "ចំនួនសរុប", "របាយការណ៍", "total", "overview", "how many"]) and not any(k in q_lower for k in ["ឈ្មោះ", "imei", "serial"]) and len(q) < 80:
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

        # ── (B) Search by Keyword (Name, Phone, ID card, Serial, IMEI, MEID, Model) ──
        clean_kw = re.sub(r"(ស្វែងរក|រក|មើល|តើ|មាន|ឈ្មោះ|លេខ|ទូរស័ព្ទ|serial|imei|meid|search|find|show|info|details|about|customer|device)", "", q, flags=re.IGNORECASE).strip()
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

        # ── (C) Format Single or Multiple Matched Contract Results ──
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

        # ── (D) General Natural Guidance Response ──
        brand_info = f"Brand **{user_brand}**" if user_brand and not is_master else "ទូទាំងប្រព័ន្ធ"
        return (
            f"🤖 **MDM AI Assistant**:\n\n"
            f"ខ្ញុំបានស្វែងរកក្នុងទិន្នន័យ {brand_info} ប៉ុន្តែមិនទាន់រកឃើញទិន្នន័យដែលត្រូវនឹង **\"{q}\"** នោះទេ។\n\n"
            f"លោកអ្នកអាចសាកល្បងសួរខ្ញុំអំពី៖\n"
            f"* 🔍 **ស្វែងរកតាមឈ្មោះអតិថិជន**: ឧទាហរណ៍ `រកឈ្មោះ Chet Vandeth`\n"
            f"* 📱 **ស្វែងរកតាមលេខទូរស័ព្ទ / IMEI / Serial / MEID**: ឧទាហរណ៍ `IMEI 351732277360759` ឬ `Serial F2LF96PN0D42`\n"
            f"* 📊 **សង្ខេបទិន្នន័យ & របាយការណ៍**: ឧទាហរណ៍ `សង្ខេបចំនួនទូរស័ព្ទ និងការបង់ប្រាក់`\n"
            f"* 🔒 **ពិនិត្យស្ថានភាព Lock**: ឧទាហរណ៍ `តើមានទូរស័ព្ទប៉ុន្មានគ្រឿងដែលជាប់ Lock?`\n"
        )
