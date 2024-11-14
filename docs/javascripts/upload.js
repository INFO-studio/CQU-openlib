document.addEventListener("DOMContentLoaded", function () {
    if (window.location.pathname.includes("/skills/")) {
        const feedbackForm = document.querySelector('form.md-feedback[name="feedback"]');
        
        // 如果找到反馈表单，则在它前面插入一行小字
        if (feedbackForm) {
            const contactText = document.createElement("p");
            contactText.textContent = "You can contact me by email: aaa@bbb.com";
            contactText.style.fontSize = "small"; // 设置字体大小为小
            feedbackForm.parentNode.insertBefore(contactText, feedbackForm);
        }
    }
});
