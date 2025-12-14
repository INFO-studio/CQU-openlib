// 未启用，补药骂我

const ysqd = 'ysqd';
const haha = 'haha';
const today = new Date();
const isAprilFoolsDay = today.getMonth() === 3 && today.getDate() === 1;

if (isAprilFoolsDay) {
    const storedValue = localStorage.getItem(ysqd);
    if (storedValue !== haha) {
        localStorage.setItem(ysqd, haha);
        window.location.href = 'https://ys.mihoyo.com/';
    }
} else {
    localStorage.removeItem(ysqd);
}