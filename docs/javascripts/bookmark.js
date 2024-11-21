document.addEventListener("DOMContentLoaded", function () {
    if (window.location.pathname.split('/').length > 3) {
        const article = document.querySelector('article.md-content__inner.md-typeset');
        if (article) {
            const firstH1 = article.querySelector('h1');
            if (firstH1) {
                const bookmarkTrigger = document.createElement("p");
                bookmarkTrigger.innerHTML = '<a class="md-button" href="#" id="bookmark-button">收藏本页</a>';
                firstH1.parentNode.insertBefore(bookmarkTrigger, firstH1.nextSibling);
            }
        }
    }
    updateMainClearBookmarksButton();
    updateBookmarkButton();
});

function isPageBookmarked() {
    const bookmarks = JSON.parse(localStorage.getItem("bookmarks")) || [];
    return bookmarks.some(bookmark => bookmark.url === window.location.href);
}

function updateMainClearBookmarksButton() {
    const button = document.getElementById("clear-bookmarks-button");
    if(button) {
        const bookmarks = JSON.parse(localStorage.getItem("bookmarks")) || [];
        if(bookmarks.length === 0) {
            button.innerHTML = "";
        } else {
            const a = document.querySelectorAll('a[href="https://github.com/INFO-studio/CQU-openlib"]')[2];
            const computedStyle = getComputedStyle(a);
            button.style.all = "unset";
            button.style.color = computedStyle.color;
            button.style.textDecoration = computedStyle.textDecoration;
            button.style.cursor = computedStyle.cursor;
        }
    }
}

function updateBookmarkButton() {
    const button = document.getElementById("bookmark-button");
    if(button) {
        if (isPageBookmarked()) {
            button.innerHTML = '取消收藏 <span class="twemoji"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="m20.8 22.7-2.9-2.9.3 1.2-6.2-3.7L5.8 21l1.6-7L2 9.2l4.9-.4L1.1 3l1.3-1.3 19.7 19.7zM22 9.2l-7.2-.6L12 2l-2 4.8 6.9 6.9z"></path></svg></span>';
            button.onclick = removeBookmark;
        } else {
            button.innerHTML = '收藏本页 <span class="twemoji"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="m5.8 21 1.6-7L2 9.2l7.2-.6L12 2l2.8 6.6 7.2.6-3.2 2.8H18c-3.1 0-5.6 2.3-6 5.3zM17 14v3h-3v2h3v3h2v-3h3v-2h-3v-3z"></path></svg></span>';
            button.onclick = bookmarkPage;
        }

    }
}

function bookmarkPage() {
    const currentPage = {
        url: window.location.href,
        title: document.title.split(" - 重庆大学资源共享计划")[0]
    };

    let bookmarks = JSON.parse(localStorage.getItem("bookmarks")) || [];
    bookmarks.push(currentPage);
    localStorage.setItem("bookmarks", JSON.stringify(bookmarks));

    alert$.next("页面已收藏");
    updateBookmarkButton();
}

function removeBookmark() {
    let bookmarks = JSON.parse(localStorage.getItem("bookmarks")) || [];
    bookmarks = bookmarks.filter(bookmark => bookmark.url !== window.location.href);
    localStorage.setItem("bookmarks", JSON.stringify(bookmarks));

    alert$.next("页面已取消收藏");
    updateBookmarkButton();
}

function displayBookmarks() {
    const bookmarks = JSON.parse(localStorage.getItem("bookmarks")) || [];
    const bookmarksContainer = document.getElementById("bookmarks-container");

    if (bookmarks.length === 0) {
        bookmarksContainer.innerHTML = "<p>您还没有收藏任何页面 _:(´□`」 ∠):_</p>";
        return;
    }

    let html = "<ul>";
    bookmarks.forEach(bookmark => {
        html += `<li><a href="${bookmark.url}">${bookmark.title}</a></li>`;
    });
    html += "</ul>";

    bookmarksContainer.innerHTML = html;
}

function clearBookmarks() {
    localStorage.removeItem("bookmarks");
    displayBookmarks();
    updateMainClearBookmarksButton();
}