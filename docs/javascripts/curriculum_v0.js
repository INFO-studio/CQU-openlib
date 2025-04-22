document.addEventListener('DOMContentLoaded', async () => {
  if (window.location.pathname === "/curriculum/") curriculum();
});

async function curriculum() {
  try {
    if (!localStorage.getItem("userCredentials")) {
      document.getElementById("curriculum-form-div").style.display = "unset";
      document.getElementById("curriculum-table-div").style.display = "none";
      saveData();
      return;
    } else {
      document.getElementById("curriculum-form-div").style.display = "none";
      document.getElementById("curriculum-table-div").style.display = "unset";
      const formFetchButton = document.getElementById("curriculum-form-action-fetch");
      if (formFetchButton) formFetchButton.innerText = "正在获取";
      await curriculumSaveEvents();
      if (formFetchButton) formFetchButton.innerText = "获取";
      
      // 确保从localStorage获取到数据后再渲染
      const eventsData = localStorage.getItem("curriculumEvents");
      if (eventsData) {
        renderCurriculum(resolveIcs(JSON.parse(eventsData).curriculumEvents));
      }
      
      // 确保只添加一次事件监听器
      const refreshButton = document.getElementById("curriculum-table-actions-refresh");
      const resetButton = document.getElementById("curriculum-table-actions-reset");
      
      if (refreshButton) {
        // 移除之前可能存在的事件监听器
        refreshButton.removeEventListener('click', curriculumRefreshEvents);
        refreshButton.addEventListener('click', curriculumRefreshEvents);
      }
      
      if (resetButton) {
        // 移除之前可能存在的事件监听器
        resetButton.removeEventListener('click', curriculumResetStorage);
        resetButton.addEventListener('click', curriculumResetStorage);
      }
    }
  } catch (error) {
    console.error("课程表初始化失败:", error);
    try {
      // 如果存在alert$对象
      if (typeof alert$ !== 'undefined' && alert$ && alert$.next) {
        alert$.next("课程表初始化失败:" + String(error));
      } else {
        alert("课程表初始化失败:" + String(error));
      }
      const formFetchButton = document.getElementById("curriculum-form-action-fetch");
      if (formFetchButton) formFetchButton.innerText = "获取";
      const tableRefreshButton = document.getElementById("curriculum-table-actions-refresh");
      if (tableRefreshButton) tableRefreshButton.innerText = "刷新课表";
    } catch (e) {
      console.error("错误处理失败:", e);
    }
    curriculumResetStorage();
  }
}

function getNextEvent() {
  // TODO
}

function saveData() {
  const form = document.getElementById("curriculum-form");
  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const username = document.getElementById("curriculum-form-username").value;
    const password = document.getElementById("curriculum-form-password").value;
    const credentials = JSON.stringify({ username, password });
    const base64Credentials = btoa(credentials);
    localStorage.setItem("userCredentials", base64Credentials);
    curriculum();
  });
}

async function curriculumSaveEvents(force = false) {
  try {
    const events = localStorage.getItem("curriculumEvents") ? JSON.parse(localStorage.getItem("curriculumEvents")) : null;
    if (!events?.timeUpdated || events.timeUpdated + 1000 * 60 * 60 * 24 < Date.now() || force) {
      if (!force) {
        document.getElementById("curriculum-form-div").style.display = "none";
        document.getElementById("curriculum-table-div").style.display = "unset";
      }
      const userCredentials = JSON.parse(atob(localStorage.getItem("userCredentials")));
      const curriculumEvents = await curriculumGetEventsFromApi(userCredentials);
      localStorage.setItem("curriculumEvents", JSON.stringify({ curriculumEvents, timeUpdated: Date.now() }));
    }
  } catch (error) {
    console.error("保存课程表事件失败:", error);
    throw error;
  }
}

async function curriculumGetEventsFromApi(userCredentials) {
  try {
    const apiUrl = "https://cquopenlib-schedule.azure-api.net/v1/subscription";
    const requestOptions = {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Ocp-Apim-Subscription-Key": "5cf6cd23acf342e39b80381a50729799"
      },
      body: JSON.stringify({
        username: userCredentials.username,
        password: userCredentials.password,
        returnStructured: false
      })
    };
    const response = await fetch(apiUrl, requestOptions);
    if (!response.ok) {
      const errorData = await response.json();
      curriculumResetStorage();
      throw new Error(`API 请求失败：${response.status} - ${errorData.message || '未知错误'}`);
    }
    const responseData = await response.json();
    return responseData.data.icsContent;
  } catch (error) {
    console.error("获取课程表失败:", error);
    curriculumResetStorage();
    throw error;
  }
}

async function curriculumRefreshEvents() {
  try {
    const tableRefreshButton = document.getElementById("curriculum-table-actions-refresh");
    if (tableRefreshButton) tableRefreshButton.innerText = "正在刷新";
    
    // 强制刷新课表数据
    await curriculumSaveEvents(true);
    
    // 获取最新数据并重新渲染
    const eventsData = localStorage.getItem("curriculumEvents");
    if (eventsData) {
      try {
        const parsedData = JSON.parse(eventsData);
        renderCurriculum(resolveIcs(parsedData.curriculumEvents));
        
        // 成功提示
        if (typeof alert$ !== 'undefined' && alert$ && alert$.next) {
          alert$.next("课表刷新成功");
        } else {
          alert("课表刷新成功");
        }
      } catch (parseError) {
        console.error("解析课表数据失败:", parseError);
        if (typeof alert$ !== 'undefined' && alert$ && alert$.next) {
          alert$.next("解析课表数据失败:" + String(parseError));
        } else {
          alert("解析课表数据失败:" + String(parseError));
        }
      }
    } else {
      // 如果没有获取到数据
      if (typeof alert$ !== 'undefined' && alert$ && alert$.next) {
        alert$.next("未能获取到课表数据，请重新登录");
      } else {
        alert("未能获取到课表数据，请重新登录");
      }
      curriculumResetStorage();
    }
  } catch (error) {
    console.error("刷新课程表失败:", error);
    if (typeof alert$ !== 'undefined' && alert$ && alert$.next) {
      alert$.next("刷新课表失败:" + String(error));
    } else {
      alert("刷新课表失败:" + String(error));
    }
  } finally {
    // 无论成功或失败，都恢复按钮文本
    const tableRefreshButton = document.getElementById("curriculum-table-actions-refresh");
    if (tableRefreshButton) tableRefreshButton.innerText = "刷新课表";
  }
}

function curriculumResetStorage() {
  localStorage.removeItem("userCredentials");
  localStorage.removeItem("curriculumEvents");
  curriculum();
}

function timeList() {
  const timeListLength = 12;
  const startTimeList = [
    { hour: 8, minute: 30 },
    { hour: 9, minute: 25 },
    { hour: 10, minute: 30 },
    { hour: 11, minute: 25 },
    { hour: 13, minute: 30 },
    { hour: 14, minute: 25 },
    { hour: 15, minute: 20 },
    { hour: 16, minute: 25 },
    { hour: 17, minute: 20 },
    { hour: 19, minute: 0 },
    { hour: 19, minute: 55 },
    { hour: 20, minute: 50 },
  ];
  const endTimeList = [
    { hour: 9, minute: 15 },
    { hour: 10, minute: 10 },
    { hour: 11, minute: 15 },
    { hour: 12, minute: 10 },
    { hour: 14, minute: 15 },
    { hour: 15, minute: 10 },
    { hour: 16, minute: 5 },
    { hour: 17, minute: 10 },
    { hour: 18, minute: 5 },
    { hour: 19, minute: 45 },
    { hour: 20, minute: 40 },
    { hour: 21, minute: 35 },
  ];
  return { timeListLength, startTimeList, endTimeList };
}

function resolveIcs(ics) {
  try {
    if (!ics || typeof ics !== 'string') {
      console.error("ICS数据无效", ics);
      return [];
    }

    const { startTimeList, endTimeList } = timeList();

    function decodeUnicode(str) {
      if (!str || typeof str !== 'string') return '';
      return str.replace(/\\u([\dA-Fa-f]{4})/gi, (_, grp) => {
        return String.fromCharCode(parseInt(grp, 16));
      });
    }

    function parseUTC(dtStr) {
      if (!dtStr || typeof dtStr !== 'string' || dtStr.length < 13) {
        return new Date(); // 返回当前时间作为默认值
      }
      const year = parseInt(dtStr.slice(0, 4));
      const month = parseInt(dtStr.slice(4, 6)) - 1;
      const day = parseInt(dtStr.slice(6, 8));
      const hour = parseInt(dtStr.slice(9, 11));
      const minute = parseInt(dtStr.slice(11, 13));
      return new Date(Date.UTC(year, month, day, hour, minute));
    }

    function parseDay(dtStr) {
      const dateBJ = parseUTC(dtStr);
      return { year: dateBJ.getFullYear(), month: dateBJ.getMonth() + 1, day: dateBJ.getDate() };
    }

    function parseTime(dtStr) {
      const dateBJ = parseUTC(dtStr);
      return { hour: dateBJ.getHours(), minute: dateBJ.getMinutes() };
    }

    function parseTeacher(teacherStr) {
      if (!teacherStr || typeof teacherStr !== 'string') return '';
      const teacher = decodeUnicode(teacherStr).match(/教师:\s*([^]+?)(?=-[A-Za-z]\d+|;|$)/);
      return teacher ? teacher[1].trim() : '';
    }

    const events = [];
    const lines = ics.split('\r\n');
    let currentEvent = [];
    let inEvent = false;

    for (const line of lines) {
      if (line === 'BEGIN:VEVENT') {
        inEvent = true;
        currentEvent = [];
      } else if (line === 'END:VEVENT') {
        inEvent = false;
        const eventObj = {};
        for (const l of currentEvent) {
          if (!l || !l.includes(':')) continue;
          const [key, value] = l.split(/:(.*)/);
          if (key) eventObj[key] = eventObj[key] ?? value;
        }
        
        try {
          const title = decodeUnicode(eventObj.SUMMARY || '');
          const day = parseDay(eventObj.DTSTART || '');
          const startTime = parseTime(eventObj.DTSTART);
          const endTime = parseTime(eventObj.DTEND);
          const teacher = parseTeacher(eventObj.DESCRIPTION || '');
          const classroom = decodeUnicode(eventObj.LOCATION || '');
          const uid = eventObj.UID || '';

          // 验证startTime和endTime是否有效
          const startTimeIndex = startTimeList.findIndex(
            item => item.hour === startTime.hour && item.minute === startTime.minute
          );
          const endTimeIndex = endTimeList.findIndex(
            item => item.hour === endTime.hour && item.minute === endTime.minute
          );

          if (startTimeIndex !== -1 && endTimeIndex !== -1 && startTimeIndex <= endTimeIndex) {
            events.push({
              uid,
              title,
              day,
              startTime: startTimeIndex,
              endTime: endTimeIndex,
              teacher,
              classroom
            });
          } else {
            console.warn("课程时间无效，忽略此条目", {startTime, endTime, title});
          }
        } catch (eventError) {
          console.error("解析课程事件失败", eventError, eventObj);
        }
      } else if (inEvent) {
        currentEvent.push(line);
      }
    }
    return events;
  } catch (error) {
    console.error("解析ICS数据失败", error);
    return [];
  }
}

function renderCurriculum(events) {

  function widthCatcher() {
    if (window.matchMedia('(min-width: 44em)').matches) {
      return 0;
    } else if (window.matchMedia('(min-width: 33em)').matches) {
      return 1;
    } else {
      return 2;
    }
  }
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const dayIndex = (today.getDay() + 6) % 7;
  const monday = new Date(today)
  monday.setDate(today.getDate() - dayIndex);
  const weekDates = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    weekDates.push(d);
  }
  const recentFiveDates = [];
  for (let i = -1; i < 4; i++) {
    const d = new Date(today);
    d.setDate(today.getDate() + i);
    recentFiveDates.push(d);
  }
  const recentThreeDates = [];
  for (let i = 0; i < 3; i++) {
    const d = new Date(today);
    d.setDate(today.getDate() + i);
    recentThreeDates.push(d);
  }
  const todayIndex = [dayIndex, 1, 0][widthCatcher()];
  const dates = [weekDates, recentFiveDates, recentThreeDates][widthCatcher()];

  const weekDayNames = ["周一", "周二", "周三", "周四", "周五", "周六", "周日"];
  const recentFiveDayNames = ["昨天", "今天", "明天", "后天", "大后天"];
  const recentThreeDayNames = ["今天", "明天", "后天"];
  const dayNames = [weekDayNames, recentFiveDayNames, recentThreeDayNames][widthCatcher()];

  const { timeListLength, startTimeList, endTimeList } = timeList();

  function formatTime(time) {
    const hour = time.hour < 10 ? "0" + time.hour : time.hour;
    const minute = time.minute < 10 ? "0" + time.minute : time.minute;
    return `${hour}:${minute}`;
  }

  function deriveTimeLabels() {
    const labels = Array.from({ length: timeListLength }, (_, index) => {
      const start = startTimeList[index];
      const end = endTimeList[index];
      return `${formatTime(start)}<br>${formatTime(end)}`;
    });
    return labels;
  }

  const timeLabels = deriveTimeLabels();
  const rows = timeListLength, cols = dates.length;
  const grid = Array.from({ length: rows }, () => Array(cols).fill(null));
  events.forEach(event => {
    const eventDate = new Date(event.day.year, event.day.month - 1, event.day.day);
    const colIndex = dates.findIndex(d =>
      d.getFullYear() === eventDate.getFullYear() &&
      d.getMonth() === eventDate.getMonth() &&
      d.getDate() === eventDate.getDate()
    );
    if (colIndex === -1) return;

    const start = event.startTime;
    const end = event.endTime;
    const rowSpan = end - start + 1;

    grid[start][colIndex] = { event, rowSpan, eventDate };
    for (let r = start + 1; r <= end; r++) {
      grid[r][colIndex] = 'occupied';
    }
  });
  const table = document.createElement('table');
  const headerRow = document.createElement('tr');
  const emptyTh = document.createElement('th');
  emptyTh.classList.add('curriculum-table-cell');
  headerRow.appendChild(emptyTh);
  dates.forEach((d, i) => {
    const th = document.createElement('th');
    th.classList.add('curriculum-table-cell');
    const month = ("0" + (d.getMonth() + 1)).slice(-2);
    const day = ("0" + d.getDate()).slice(-2);
    th.innerHTML = `${dayNames[i]}<br>${month}-${day}`;
    if (d.toDateString() === today.toDateString()) {
      th.classList.add("curriculum-table-today");
    }
    headerRow.appendChild(th);
  });
  table.appendChild(headerRow);
  for (let r = 0; r < rows; r++) {
    const tr = document.createElement('tr');
    const timeTd = document.createElement('td');
    timeTd.innerHTML = timeLabels[r];
    timeTd.classList.add('curriculum-table-cell');
    tr.appendChild(timeTd);
    for (let c = 0; c < cols; c++) {
      if (grid[r][c] === 'occupied') continue;
      const td = document.createElement('td');
      td.classList.add('curriculum-table-cell');
      if (c === todayIndex) {
        td.classList.add('curriculum-table-today');
      }
      if (grid[r][c] && grid[r][c].event) {
        const { event, rowSpan, eventDate } = grid[r][c];
        td.rowSpan = rowSpan;
        td.classList.add('curriculum-table-cell-scheduled');
        const flexbox = document.createElement('div');
        flexbox.classList.add('curriculum-event-flexbox');
        eventTitle = document.createElement('strong');
        eventTitle.classList.add('curriculum-event-title');
        eventTitle.innerHTML = event.title;
        flexbox.appendChild(eventTitle);
        eventTeacher = document.createElement('div');
        eventTeacher.classList.add('curriculum-event-teacher');
        eventTeacher.innerHTML = event.teacher;
        flexbox.appendChild(eventTeacher);
        eventClassroom = document.createElement('div');
        eventClassroom.classList.add('curriculum-event-classroom');
        eventClassroom.innerHTML = event.classroom;
        flexbox.appendChild(eventClassroom);
        const dialog = document.createElement('dialog');
        dialog.id = "eventDialog-" + event.uid;
        dialog.classList.add('curriculum-event-dialog');
        dialog.addEventListener('click', (event) => {
          if (event.target === dialog) {
            dialog.close();
          }
        });
        const dialogTitle = document.createElement('div');
        dialogTitle.classList.add('curriculum-event-dialog-title');
        dialogTitle.innerHTML = event.title;
        dialog.appendChild(dialogTitle);
        const dialogTeacher = document.createElement('p');
        dialogTeacher.classList.add('curriculum-event-dialog-teacher');
        dialogTeacher.innerHTML = `${event.teacher}`;
        dialog.appendChild(dialogTeacher);
        const dialogClassroom = document.createElement('p');
        dialogClassroom.classList.add('curriculum-event-dialog-classroom');
        dialogClassroom.innerHTML = `${event.classroom}`;
        dialog.appendChild(dialogClassroom);
        const dialogDate = document.createElement('p');
        dialogDate.classList.add('curriculum-event-dialog-date');
        dialogDate.innerHTML = `${event.day.year}年${event.day.month}月${event.day.day}日 ${formatTime(startTimeList[event.startTime])} - ${formatTime(endTimeList[event.endTime])}`;
        dialog.appendChild(dialogDate);
        flexbox.onclick = () => {
          dialog.showModal();
        }
        td.appendChild(flexbox);
        td.appendChild(dialog);
      }
      tr.appendChild(td);
    }
    table.appendChild(tr);
  }
  const tableDiv = document.querySelector('.curriculum-table-time');
  tableDiv.innerHTML = "";
  tableDiv.appendChild(table);
}