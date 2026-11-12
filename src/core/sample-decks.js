// Bộ đề mẫu tích hợp sẵn (Starter Sample Decks) — giúp người dùng trải nghiệm ngay
// mọi chế độ học: Đề THPT 2026 (Phần I/II/III), Reading Cloze Split-Screen, và Đa năng.

export function countDeckQuestions(payload) {
  if (!payload) return 0;
  if (Array.isArray(payload.questions)) return payload.questions.length;
  if (Array.isArray(payload.parts)) {
    return payload.parts.reduce((n, p) => n + (Array.isArray(p.questions) ? p.questions.length : 0), 0);
  }
  return 0;
}

export const SAMPLE_DECKS = [
  {
    key: "thpt2026_physics",
    title: "Đề THPT 2026 — Vật lí (Mẫu 3 Phần)",
    badge: "Chuẩn 2026",
    subtitle: "Trải nghiệm đủ 3 phần: Trắc nghiệm 4 lựa chọn, Đúng/Sai 4 ý (a-d) và Trả lời ngắn điền số.",
    icon: "FlaskConical",
    payload: {
      examFormat: "thpt2026",
      subject: "Vật lí",
      parts: [
        {
          part: "I",
          type: "multiple_choice",
          questions: [
            {
              id: "P1_1",
              level: "nhan_biet",
              question: "Trong hệ SI, đơn vị của nhiệt dung riêng là:",
              options: ["A. J/(kg.K)", "B. J/kg", "C. J/K", "D. W/(m.K)"],
              answer: "A. J/(kg.K)",
              explanation: "Nhiệt dung riêng $c = \\frac{Q}{m \\Delta T}$ có đơn vị chuẩn trong hệ SI là **J/(kg.K)**.",
              hint: "Nhớ công thức tính nhiệt lượng Q = m.c.ΔT"
            },
            {
              id: "P1_2",
              level: "thong_hieu",
              question: "Một lượng khí lí tưởng xác định biến đổi đẳng nhiệt. Khi thể tích của khối khí giảm đi 2 lần thì áp suất của khối khí sẽ:",
              options: [
                "A. Tăng lên 2 lần",
                "B. Giảm đi 2 lần",
                "C. Không thay đổi",
                "D. Tăng lên 4 lần"
              ],
              answer: "A. Tăng lên 2 lần",
              explanation: "Theo định luật Boyle cho quá trình đẳng nhiệt: `p1.V1 = p2.V2`. Khi thể tích giảm 2 lần thì áp suất **tăng 2 lần**."
            },
            {
              id: "P1_3",
              level: "van_dung",
              question: "Sóng điện từ có tần số `f = 100 MHz` truyền trong chân không với tốc độ `c = 3.10^8 m/s` thì có bước sóng bằng:",
              options: ["A. 3 m", "B. 0,3 m", "C. 30 m", "D. 300 m"],
              answer: "A. 3 m",
              explanation: "Bước sóng: $\\lambda = \\frac{c}{f} = \\frac{3 \\cdot 10^8}{100 \\cdot 10^6} = 3\\text{ m}$."
            }
          ]
        },
        {
          part: "II",
          type: "true_false",
          questions: [
            {
              id: "P2_1",
              level: "van_dung",
              question: "Một bình kín có thể tích `V = 12 lít` chứa khí lí tưởng ở nhiệt độ `27°C` và áp suất `p = 2 atm`. Cho biết các nhận định sau là Đúng hay Sai:",
              items: [
                { text: "Nhiệt độ tuyệt đối của khối khí ở trạng thái đầu là 300 K.", correct: true },
                { text: "Khi đun nóng đẳng tích để nhiệt độ tăng lên 327°C thì áp suất khí vẫn bằng 2 atm.", correct: false },
                { text: "Nếu nhiệt độ tuyệt đối tăng gấp đôi trong quá trình đẳng tích thì áp suất mới là 4 atm.", correct: true },
                { text: "Nội năng của khí lí tưởng chỉ phụ thuộc vào thể tích của bình chứa.", correct: false }
              ],
              explanation: "- **Ý a Đúng**: `T = 27 + 273 = 300 K`.\n- **Ý b Sai**: Đẳng tích thì áp suất tỉ lệ thuận với nhiệt độ tuyệt đối `T`.\n- **Ý c Đúng**: `T2 = 600 K = 2.T1` nên `p2 = 2.p1 = 4 atm`.\n- **Ý d Sai**: Nội năng khí lí tưởng chỉ phụ thuộc vào nhiệt độ."
            }
          ]
        },
        {
          part: "III",
          type: "short_answer",
          questions: [
            {
              id: "P3_1",
              level: "van_dung",
              question: "Cung cấp nhiệt lượng `Q = 1500 J` cho một khối khí trong xilanh, khí giãn nở thực hiện công `A = 900 J` đẩy pit-tông. Độ biến thiên nội năng `ΔU` của khối khí bằng bao nhiêu Jun (J)?",
              answer: "600",
              explanation: "Theo nguyên lí I Nhiệt động lực học: `ΔU = Q - A = 1500 - 900 = 600 J`."
            },
            {
              id: "P3_2",
              level: "van_dung_cao",
              question: "Một dây dẫn thẳng dài `0,5 m` mang dòng điện `I = 4 A` đặt vuông góc với các đường sức của một từ trường đều có cảm ứng từ `B = 0,25 T`. Lực từ tác dụng lên đoạn dây có độ lớn bằng bao nhiêu Newton (N)?",
              answer: "0.5",
              explanation: "Áp dụng công thức lực từ: `F = B.I.L.sin(90°) = 0,25 × 4 × 0,5 × 1 = 0,5 N`."
            }
          ]
        }
      ]
    }
  },
  {
    key: "english_reading_cloze",
    title: "TOEIC & IELTS — Reading & Cloze Studio",
    badge: "Split-Screen",
    subtitle: "Trải nghiệm giao diện đọc hiểu 2 cột chuẩn quốc tế kèm vị trí đục lỗ tương tác thông minh.",
    icon: "Languages",
    payload: {
      format: "mixed",
      topic: "TOEIC Reading & Cloze Practice",
      questions: [
        {
          id: "CLOZE_22",
          type: "multiple_choice",
          topic: "Part 6: Text Completion",
          passageTitle: "Memo: Annual Product Launch Conference (Questions 22-24)",
          passage: "To: All Marketing Staff\nFrom: Elena Rostova, Director of Global Marketing\nSubject: Annual Product Launch Conference\n\nThank you for your dedication over the past quarter. Our flagship event will take place next Friday at the Grand Marina Center. Please make sure you are (22)__________ with the updated schedule before arriving at the venue.\n\nBecause we expect over 400 international partners, registration desks will open two hours (23)__________ the keynote presentation begins. This will allow our team to welcome guests smoothly and distribute press kits.\n\nFinally, each department lead should prepare a brief summary so that we can present a (24)__________ strategy during the afternoon executive roundtable.",
          blankIndex: 22,
          question: "Select the best word to fill in blank (22):",
          options: [
            "A. familiar",
            "B. familiarity",
            "C. familiarize",
            "D. familiarly"
          ],
          answer: "A. familiar",
          explanation: "Cấu trúc tính từ **be familiar with something** (quen thuộc/nắm rõ điều gì). Sau động từ to be `are` và trước giới từ `with` cần một tính từ."
        },
        {
          id: "CLOZE_23",
          type: "multiple_choice",
          topic: "Part 6: Text Completion",
          passageTitle: "Memo: Annual Product Launch Conference (Questions 22-24)",
          passage: "To: All Marketing Staff\nFrom: Elena Rostova, Director of Global Marketing\nSubject: Annual Product Launch Conference\n\nThank you for your dedication over the past quarter. Our flagship event will take place next Friday at the Grand Marina Center. Please make sure you are (22)__________ with the updated schedule before arriving at the venue.\n\nBecause we expect over 400 international partners, registration desks will open two hours (23)__________ the keynote presentation begins. This will allow our team to welcome guests smoothly and distribute press kits.\n\nFinally, each department lead should prepare a brief summary so that we can present a (24)__________ strategy during the afternoon executive roundtable.",
          blankIndex: 23,
          question: "Select the best word to fill in blank (23):",
          options: [
            "A. prior",
            "B. before",
            "C. ahead",
            "D. during"
          ],
          answer: "B. before",
          explanation: "Cần một liên từ nối mệnh đề `the keynote presentation begins`. **before** + mệnh đề (trước khi bài thuyết trình bắt đầu). `prior` đi kèm `to`, `ahead` đi kèm `of`."
        },
        {
          id: "CLOZE_24",
          type: "multiple_choice",
          topic: "Part 6: Text Completion",
          passageTitle: "Memo: Annual Product Launch Conference (Questions 22-24)",
          passage: "To: All Marketing Staff\nFrom: Elena Rostova, Director of Global Marketing\nSubject: Annual Product Launch Conference\n\nThank you for your dedication over the past quarter. Our flagship event will take place next Friday at the Grand Marina Center. Please make sure you are (22)__________ with the updated schedule before arriving at the venue.\n\nBecause we expect over 400 international partners, registration desks will open two hours (23)__________ the keynote presentation begins. This will allow our team to welcome guests smoothly and distribute press kits.\n\nFinally, each department lead should prepare a brief summary so that we can present a (24)__________ strategy during the afternoon executive roundtable.",
          blankIndex: 24,
          question: "Select the best word to fill in blank (24):",
          options: [
            "A. cohesive",
            "B. hesitant",
            "C. temporary",
            "D. reluctant"
          ],
          answer: "A. cohesive",
          explanation: "**cohesive strategy** = chiến lược gắn kết, thống nhất. Các phương án khác mang nghĩa ngập ngừng (`hesitant`), tạm thời (`temporary`), miễn cưỡng (`reluctant`)."
        },
        {
          id: "RC_31",
          type: "short_answer",
          topic: "Part 7: Reading Comprehension",
          passageTitle: "Aurora Cloud Workspace Pricing Tiers",
          passage: "Aurora Cloud Workspace — Enterprise Upgrade Notice\n\nWe are upgrading our cloud storage infrastructure next month to deliver 3x faster synchronization across all devices.\n\n| Plan Tier | Monthly Storage | Team Seats | Support Level |\n|---|---|---|---|\n| Starter | 100 GB | Up to 5 | Community Forum |\n| Pro Studio | 2 TB | Up to 25 | 24/7 Priority Chat |\n| Enterprise | Unlimited | Unlimited | Dedicated Engineer |",
          question: "Which plan tier offers 2 TB of monthly storage and 24/7 Priority Chat?",
          answer: "Pro Studio",
          acceptableAnswers: ["Pro Studio Plan", "The Pro Studio tier", "Pro"],
          explanation: "Tra cứu dòng thứ 2 trong bảng: gói **Pro Studio** cung cấp `2 TB` dung lượng và hỗ trợ `24/7 Priority Chat`."
        }
      ]
    }
  },
  {
    key: "econometrics_mixed",
    title: "Kinh tế lượng & Phân tích Dữ liệu",
    badge: "Đa năng",
    subtitle: "Kết hợp Trắc nghiệm, Trả lời ngắn tính toán và Tự luận phân tích mô hình hồi quy.",
    icon: "Calculator",
    payload: {
      format: "mixed",
      topic: "Kinh tế lượng & Hồi quy",
      questions: [
        {
          id: "C1_Q1",
          type: "multiple_choice",
          topic: "Chương 1: Mô hình hồi quy cổ điển",
          level: "nhan_biet",
          question: "Phương pháp bình phương nhỏ nhất thông thường (OLS) tìm các hệ số ước lượng bằng cách cực tiểu hóa đại lượng nào sau đây?",
          options: [
            "A. Tổng bình phương các phần dư (RSS)",
            "B. Tổng bình phương toàn bộ sai lệch (TSS)",
            "C. Tổng bình phương được giải thích bởi mô hình (ESS)",
            "D. Tổng giá trị tuyệt đối của các phần dư"
          ],
          answer: "A. Tổng bình phương các phần dư (RSS)",
          explanation: "Phương pháp **OLS (Ordinary Least Squares)** cực tiểu hóa $\\text{RSS} = \\sum e_i^2$, tức tổng bình phương các phần dư."
        },
        {
          id: "C2_Q2",
          type: "short_answer",
          topic: "Chương 2: Độ phù hợp mô hình",
          level: "van_dung",
          question: "Trong một mô hình hồi quy tuyến tính có `TSS = 1200` và `RSS = 300`. Hệ số xác định `R^2` của mô hình bằng bao nhiêu?",
          answer: "0.75",
          acceptableAnswers: ["75%", "0,75", "3/4"],
          explanation: "Ta có `ESS = TSS - RSS = 1200 - 300 = 900`. Suy ra $R^2 = \\frac{\\text{ESS}}{\\text{TSS}} = \\frac{900}{1200} = 0.75$ (hay **75%**)."
        },
        {
          id: "C3_Q1",
          type: "essay",
          topic: "Chương 3: Khuyết tật mô hình",
          level: "van_dung_cao",
          question: "Nêu hậu quả của hiện tượng phương sai sai số thay đổi (Heteroscedasticity) đối với các ước lượng OLS và cách khắc phục phổ biến.",
          answer: "- Ước lượng OLS vẫn không chệch (unbiased) và vững (consistent).\n- Nhưng ước lượng OLS không còn hiệu quả (không còn là BLUE — phương sai không nhỏ nhất).\n- Sai số chuẩn (SE) bị chệch dẫn đến các kiểm định t và F không còn đáng tin cậy.\n+ Cách khắc phục: Sử dụng sai số chuẩn vững White (Robust Standard Errors), phương pháp bình phương nhỏ nhất tổng quát (GLS/WLS), hoặc lấy logarit biến số.",
          explanation: "Đảm bảo nêu được 2 ý cốt lõi: **tính không chệch vẫn giữ nguyên** nhưng **mất tính hiệu quả & làm sai lệch kiểm định t, F**."
        }
      ]
    }
  }
];

