// Onboarding 3 bước — chỉ hiện lần đầu, dismiss được.
import { isOnboarded, setOnboarded } from "../core/storage/local.js";

export function initOnboarding() {
  if (isOnboarded()) return;

  const overlay = document.getElementById("onboarding");
  const steps = overlay.querySelectorAll(".onboarding-step");
  const dots = overlay.querySelectorAll(".onboarding-dots .dot");
  const nextBtn = document.getElementById("onboardingNext");
  let current = 0;

  overlay.hidden = false;

  function show(step) {
    steps.forEach((el, i) => (el.hidden = i !== step));
    dots.forEach((dot, i) => dot.classList.toggle("active", i === step));
    nextBtn.textContent = step === steps.length - 1 ? "Bắt đầu" : "Tiếp";
  }
  show(current);

  function finish() {
    setOnboarded();
    overlay.remove(); // gỡ hẳn khỏi DOM, không phụ thuộc thuộc tính hidden
  }

  nextBtn.addEventListener("click", () => {
    if (current < steps.length - 1) {
      current++;
      show(current);
    } else {
      finish();
    }
  });
  document.getElementById("onboardingSkip").addEventListener("click", finish);
}
