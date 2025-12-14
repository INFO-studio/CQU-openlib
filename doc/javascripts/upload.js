document.addEventListener("DOMContentLoaded", function () {
    if (window.location.pathname.includes("/course/")) {
        const feedbackForm = document.querySelector('form.md-feedback[name="feedback"]');
        if (feedbackForm) {
            const uploadFileTrigger = document.createElement("p");
            uploadFileTrigger.innerHTML = '<br>如您有本站未收录的文件，欢迎通过<a href="https://forms.office.com/Pages/ResponsePage.aspx?id=DQSIkWdsW0yxEjajBLZtrQAAAAAAAAAAAAMAAA7OwxpURE8xNTROTVRBQTc3M0tDTThaWTVQOENaRC4u">表单</a>来上传文件';
            uploadFileTrigger.style.textAlign = "center";
            feedbackForm.parentNode.insertBefore(uploadFileTrigger, feedbackForm);
        }
    }
});
