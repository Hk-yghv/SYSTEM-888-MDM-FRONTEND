# MDM Calculate Schedule - កម្មវិធីគណនាការប្រាក់លើ iOS (iPhone & iPad)

កម្មវិធីគណនាការប្រាក់ និងកាលវិភាគបង់ប្រាក់សម្រាប់ប្រព័ន្ធប្រតិបត្តិការ **iOS (iPhone / iPad)**។
គណនាការប្រាក់ថេរលើប្រាក់ដើមដើមរៀងរាល់ខែ និងបែងចែកប្រាក់ដើមបង់ថេរប្រចាំខែ។ កាលបរិច្ឆេទបង់ប្រាក់គណនាបានសុក្រិត មិនលោតខ្វះថ្ងៃនៅពេលខែកុម្ភៈ ឬខែដែលមាន 30/31 ថ្ងៃឡើយ។

---

## 🚀 ជម្រើសក្នុងការប្រើប្រាស់ និងដំឡើង (2 Options)

### 🔹 ជម្រើសទី ១ (ងាយស្រួលបំផុត & លឿនបំផុត - 10 វិនាទី) : PWA / Web Clip
> មិនបាច់ប្រើកុំព្យូទ័រ Mac ឬគណនី Apple Developer ទេ! ដំណើរការដូច Native App 100% (ពេញអេក្រង់ Fullscreen, មាន Icon លើ Home Screen, ដំណើរការបានលឿន)

1. បើក Link កម្មវិធីក្នុង **Safari** លើ iPhone / iPad
2. ចុចប៊ូតុង **Share (ចែករំលែក 📤)** នៅរបារខាងក្រោម
3. អូសចុះក្រោម រួចចុចយក **"Add to Home Screen (បន្ថែមទៅអេក្រង់ដើម ➕)"**
4. ចុច **"Add (បន្ថែម)"** នៅជ្រុងខាងស្ដាំខាងលើ
5. រួចរាល់! App នឹងបង្ហាញនៅលើ Home Screen របស់អ្នក ហើយអាចចុចបើកប្រើប្រាស់បានភ្លាមៗ។

---

### 🔹 ជម្រើសទី ២ : ដំឡើងតាម Xcode (Native iOS App)
> សម្រាប់ Developer ដែលចង់ Build ជា Native iOS App (.ipa) តាមរយៈ Xcode

1. បើក Folder `ios-calculate-app` លើ Mac
2. បើកជាមួយ **Xcode** (SwiftUI App Project)
3. ភ្ជាប់ iPhone របស់អ្នក រួចជ្រើសរើស Device ក្នុង Xcode
4. ចុច **Run (Cmd + R)** ដើម្បីដំឡើងចូលក្នុង iPhone ផ្ទាល់។

---

## 🌟 លក្ខណៈពិសេស (Features)
- 📅 **ការគណនាកាលបរិច្ឆេទសុក្រិត (Safe Add Months)**: ដំណើរការដូច `CalculateSchedule1.jsx` ដោយមិនមានបញ្ហាលោតខែ ឬខ្វះថ្ងៃក្នុង Timezone កម្ពុជា (UTC+7)។
- 🌓 **Dark Mode / Light Mode**: គាំទ្រទាំងស្បែកងងឹត និងពន្លឺ។
- 📋 **Copy & Share Quick Summary**: ចម្លងសេចក្ដីសង្ខេប និងចែករំលែកតាម Telegram/Messenger បានយ៉ាងរហ័ស។
- 📱 **iOS Safe Area Support**: រៀបចំស្អាតឥតខ្ចោះជាមួយ Notch និង Dynamic Island របស់ iPhone។
