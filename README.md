# 📚 Quitz — Quiz App (PWA + Firebase)

Tải lên file JSON để tạo quiz ôn tập **trắc nghiệm & tự luận**. Hoạt động offline, cài được thành app (PWA), lưu trữ vĩnh viễn trên cloud qua Firebase.

## ✨ Tính năng

- **Nhập quiz 3 cách**: kéo thả file JSON, dán vào ô nhập, hoặc `Ctrl + V` ở bất kỳ đâu.
- **Tự nhận diện định dạng**: trắc nghiệm / tự luận, nhiều chủ đề, nhiều cấu trúc JSON.
- **Học thuộc thông minh**:
  - *Lặp lại ngắt quãng (Leitner)*: câu sai tự động lên lịch ôn lại sau 10 phút → 1 ngày → 3 → 7 → 14 ngày; nút "🔁 Ôn câu yếu" hiện khi có câu đến hạn.
  - *Flashcard tự chấm* cho câu tự luận: tự gợi nhớ trước khi lật thẻ, tự đánh giá "Đã thuộc / Chưa thuộc".
  - Xáo cả câu hỏi lẫn lựa chọn; ôn nhanh 10 câu từ toàn bộ thư viện; phiên 10/20 câu chống quá tải.
- **Chia sẻ bằng 1 link 🔗**: bấm nút share ở mỗi quiz (hoặc màn kết quả). Quiz đã lưu cloud → link ngắn `?s=...`; quiz local → JSON nén thẳng vào URL, không cần server. Người nhận mở link là thêm được vào thư viện.
- **PWA**: cài thành app trên Android/iOS/desktop, chạy offline hoàn toàn.
- **Firebase (tùy chọn)**: đăng nhập Email/Google, lưu quiz vĩnh viễn trên cloud, đồng bộ thiết bị.
- **UX**: dark/light theme, toast thay alert, onboarding lần đầu, xuất quiz ra JSON.

Khi **chưa cấu hình Firebase**, app vẫn chạy đầy đủ ở chế độ local (localStorage) — nút đăng nhập tự ẩn.

## 🚀 Chạy local

```bash
npm install
npm run dev        # dev server
npm run build      # build production vào dist/
npm run preview    # chạy thử bản build
npm run icons      # (tùy chọn) tạo lại PNG icons cho PWA
```

## ☁️ Bật Firebase (Auth + Firestore + Hosting)

### 1. Tạo project
1. Vào [console.firebase.google.com](https://console.firebase.google.com) → **Add project**.
2. **Authentication** → Sign-in method → bật **Email/Password** và **Google**.
3. **Firestore Database** → **Create database** (chọn region gần VN, bắt đầu ở *production mode*).
4. **Project settings** → Your apps → thêm **Web app (</>**) → copy `firebaseConfig`.

### 2. Cấu hình app
```bash
copy .env.example .env
```
Dán các giá trị `VITE_FIREBASE_*` vào `.env` rồi chạy lại `npm run dev` / build lại.

### 3. Firestore security rules
Firestore Console → Rules → dán:

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /quizzes/{quizId} {
      allow read: if resource.data.isPublic == true
                  || request.auth != null
                  && request.auth.uid == resource.data.ownerId;
      allow create: if request.auth != null
                    && request.resource.data.ownerId == request.auth.uid;
      allow update, delete: if request.auth != null
                            && request.auth.uid == resource.data.ownerId;
    }
    match /users/{uid}/{document=**} {
      allow read, write: if request.auth != null && request.auth.uid == uid;
    }
    match /{document=**} {
      allow read, write: if false;
    }
  }
}
```

### 4. Deploy Hosting
```bash
npm i -g firebase-tools
firebase login
firebase init hosting   # chọn dist/ làm public dir, Yes cho SPA rewrite
npm run deploy          # = build + firebase deploy
```
Sau khi deploy, thêm domain host vào **Authentication → Settings → Authorized domains** (localhost đã có sẵn):
- Firebase Hosting: `*.web.app` tự thêm sẵn.
- Vercel: thêm `ten-project.vercel.app`.
- Lưu ý: `.env` không được push lên GitHub — trên Vercel phải dán lại 6 biến `VITE_FIREBASE_*` trong *Settings → Environment Variables* rồi redeploy.

## 📱 Cài thành app (PWA)

- **Android (Chrome)**: mở app → nút **⬇️ Tải app** trên thanh trên cùng (hoặc menu ⋮ → *Add to Home screen*).
- **iOS (Safari)**: nút **Chia sẻ ⬆** → *Thêm vào Màn hình chính*.
- **Desktop (Chrome/Edge)**: biểu tượng cài ở cuối thanh địa chỉ.

App chạy fullscreen, offline hoàn toàn (quiz đã lưu trong máy vẫn làm được khi mất mạng).

## 🗂️ Cấu trúc code

```
src/
├── main.js               # bootstrap, nối các views
├── config/firebase.js    # khởi tạo Firebase (tự tắt khi thiếu .env)
├── core/
│   ├── quiz-parser.js    # parse đa định dạng JSON
│   ├── quiz-engine.js    # state machine phiên làm bài
│   ├── store.js          # state + subscribe/emit
│   └── storage/
│       ├── local.js      # localStorage (offline-first)
│       └── cloud.js      # Firestore (sync, kết quả)
├── auth/                 # Firebase Auth + modal đăng nhập
├── pwa/install.js        # beforeinstallprompt + hướng dẫn iOS
└── ui/                   # views, toast, modal, theme, onboarding
```

## 🧪 Định dạng JSON hỗ trợ

```json
{
  "type": "multiple_choice",
  "topic": "TÊN CHỦ ĐỀ",
  "questions": [
    { "id": "CD1_1", "question": "Câu hỏi?", "options": ["A. ...", "B. ..."], "answer": "A. ..." }
  ]
}
```

Tự luận: `"type": "essay"`, mỗi câu có `question` + `answer` (dòng bắt đầu bằng `-` là ý chính, `+` là ý phụ).
Cũng hỗ trợ: mảng câu hỏi, mảng nhiều chủ đề, object lồng nhiều mảng.
