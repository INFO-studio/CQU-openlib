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
      const eventsData = localStorage.getItem("curriculumEvents");
      if (eventsData) {
        document.getElementById("curriculum-form-div").style.display = "none";
        document.getElementById("curriculum-table-div").style.display = "unset";
        
        const parsedData = JSON.parse(eventsData);
        renderCurriculum(parsedData.curriculumEvents);
        
        const refreshButton = document.getElementById("curriculum-table-actions-refresh");
        const resetButton = document.getElementById("curriculum-table-actions-reset");
        
        if (refreshButton) {
          refreshButton.removeEventListener('click', curriculumRefreshEvents);
          refreshButton.addEventListener('click', curriculumRefreshEvents);
        }
        
        if (resetButton) {
          resetButton.removeEventListener('click', curriculumResetStorage);
          resetButton.addEventListener('click', curriculumResetStorage);
        }
      } else {
        const formFetchButton = document.getElementById("curriculum-form-action-fetch");
        if (formFetchButton) {
          formFetchButton.innerHTML = `<svg class="loading-spinner" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><circle cx="12" cy="12" r="10" fill="none" stroke="currentColor" stroke-width="2" stroke-dasharray="42" stroke-dashoffset="15" stroke-linecap="round"></circle></svg> 正在获取`;
          formFetchButton.disabled = true;
        }
        
        try {
          await curriculumSaveEvents(true);
          
          document.getElementById("curriculum-form-div").style.display = "none";
          document.getElementById("curriculum-table-div").style.display = "unset";
          
          const eventsData = localStorage.getItem("curriculumEvents");
          if (eventsData) {
            const parsedData = JSON.parse(eventsData);
            renderCurriculum(parsedData.curriculumEvents);
          }
          
          const refreshButton = document.getElementById("curriculum-table-actions-refresh");
          const resetButton = document.getElementById("curriculum-table-actions-reset");
          
          if (refreshButton) {
            refreshButton.removeEventListener('click', curriculumRefreshEvents);
            refreshButton.addEventListener('click', curriculumRefreshEvents);
          }
          
          if (resetButton) {
            resetButton.removeEventListener('click', curriculumResetStorage);
            resetButton.addEventListener('click', curriculumResetStorage);
          }
        } catch (error) {
          console.error("初始获取课表失败:", error);
          alert$.next("获取课表失败:" + String(error));
          if (formFetchButton) {
            formFetchButton.innerHTML = "获取";
            formFetchButton.disabled = false;
          }
        }
      }
    }
  } catch (error) {
    console.error("课程表初始化失败:", error);
    alert$.next("课程表初始化失败:" + String(error));
    const formFetchButton = document.getElementById("curriculum-form-action-fetch");
    if (formFetchButton) {
      formFetchButton.innerHTML = "获取";
      formFetchButton.disabled = false;
    }
    const tableRefreshButton = document.getElementById("curriculum-table-actions-refresh");
    if (tableRefreshButton) {
      tableRefreshButton.innerHTML = "刷新课表";
      tableRefreshButton.disabled = false;
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
    
    const formFetchButton = document.getElementById("curriculum-form-action-fetch");
    if (formFetchButton) {
      formFetchButton.innerHTML = `<div style="display: flex; align-items: center; justify-content: center; gap: 0.5em"><svg class="loading-spinner" width="1em" height="1em" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><circle cx="12" cy="12" r="10" fill="none" stroke="currentColor" stroke-width="2" stroke-dasharray="42" stroke-dashoffset="15" stroke-linecap="round"></circle></svg><span>正在获取</span></div>`;
      formFetchButton.disabled = true;
    }
    
    try {
      const userCredentials = JSON.parse(atob(localStorage.getItem("userCredentials")));
      const curriculumEvents = await curriculumGetEventsFromApi(userCredentials);
      localStorage.setItem("curriculumEvents", JSON.stringify({ curriculumEvents, timeUpdated: Date.now() }));
      
      curriculum();
    } catch (error) {
      console.error("获取课程表失败:", error);
      alert$.next("获取课表失败:" + String(error));
      if (formFetchButton) {
        formFetchButton.innerHTML = "获取";
        formFetchButton.disabled = false;
      }
      curriculumResetStorage();
    }
  });
}

async function curriculumSaveEvents(force = false) {
  try {
    const events = localStorage.getItem("curriculumEvents") ? JSON.parse(localStorage.getItem("curriculumEvents")) : null;
    if (!events?.timeUpdated || events.timeUpdated + 1000 * 60 * 60 * 24 < Date.now() || force) {
      const userCredentials = JSON.parse(atob(localStorage.getItem("userCredentials")));
      const curriculumEvents = await curriculumGetEventsFromApi(userCredentials);
      localStorage.setItem("curriculumEvents", JSON.stringify({ curriculumEvents, timeUpdated: Date.now() }));
    }
  } catch (error) {
    console.error("保存课程表事件失败:", error);
    throw error;
  } finally {
    const formFetchButton = document.getElementById("curriculum-form-action-fetch");
    if (formFetchButton) {
      formFetchButton.innerHTML = "获取";
      formFetchButton.disabled = false;
    }
  }
}

async function curriculumGetEventsFromApi(userCredentials) {
  try {
    const apiUrl = "https://cquopenlib-schedule.azure-api.net/v1/subscription";
    // const apiUrl = "http://localhost:3001/api";
    //本地调试用，反向代理
    const requestOptions = {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Ocp-Apim-Subscription-Key": "5cf6cd23acf342e39b80381a50729799"
      },
      body: JSON.stringify({
        username: userCredentials.username,
        password: userCredentials.password,
        returnStructured: true  // 请求JSON格式的数据
      })
    };
    
    const response = await fetch(apiUrl, requestOptions);
    
    if (!response.ok) {
      const errorData = await response.json();
      curriculumResetStorage();
      throw new Error(`API 请求失败：${response.status} - ${errorData.message || '未知错误'}`);
    }
    
    const responseData = await response.json();
    if (!responseData.data) {
      console.error("API返回数据格式不正确:", responseData);
      throw new Error("API返回的数据格式不正确");
    }
    if (responseData.data.weeks && Array.isArray(responseData.data.weeks)) {
      console.log("获取到JSON格式的课表数据");
      return resolveLectures(responseData.data.weeks);
    }
    else if (responseData.data.icsContent) {
      console.warn("获取到ICS格式的课表数据，服务器没有返回JSON格式");
      return [];
    } 
    else {
      console.error("未能获取到有效的课表数据:", responseData.data);
      return [];
    }
  } catch (error) {
    console.error("获取课程表失败:", error);
    curriculumResetStorage();
    throw error;
  }
}

async function curriculumRefreshEvents() {
  try {
    const tableRefreshButton = document.getElementById("curriculum-table-actions-refresh");
    if (tableRefreshButton) {
      tableRefreshButton.innerHTML = `<svg class="loading-spinner" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><circle cx="12" cy="12" r="10" fill="none" stroke="currentColor" stroke-width="2" stroke-dasharray="42" stroke-dashoffset="15" stroke-linecap="round"></circle></svg> 正在刷新`;
      tableRefreshButton.disabled = true;
    }
    await curriculumSaveEvents(true);
    const eventsData = localStorage.getItem("curriculumEvents");
    if (eventsData) {
      const parsedData = JSON.parse(eventsData);
      renderCurriculum(parsedData.curriculumEvents);
      alert$.next("课表刷新成功");
    } else {
      alert$.next("未能获取到课表数据，请重新登录");
      curriculumResetStorage();
    }
  } catch (error) {
    console.error("刷新课程表失败:", error);
    alert$.next("刷新课表失败:" + String(error));
  } finally {
    const tableRefreshButton = document.getElementById("curriculum-table-actions-refresh");
    if (tableRefreshButton) {
      tableRefreshButton.innerHTML = "刷新课表";
      tableRefreshButton.disabled = false;
    }
  }
}

function curriculumResetStorage() {
  localStorage.removeItem("userCredentials");
  localStorage.removeItem("curriculumEvents");
  curriculum();
}

function timeList() {
  const timeListLength = 12;
  const startTimeList = LectureTimeList.map(time => ({ hour: time.startHour, minute: time.startMinute }));
  const endTimeList = LectureTimeList.map(time => ({ hour: time.endHour, minute: time.endMinute }));
  return { timeListLength, startTimeList, endTimeList };
}

const LectureTimeList = [
  { startHour: 8, startMinute: 30, endHour: 9, endMinute: 15 },
  { startHour: 9, startMinute: 25, endHour: 10, endMinute: 10 },
  { startHour: 10, startMinute: 30, endHour: 11, endMinute: 15 },
  { startHour: 11, startMinute: 25, endHour: 12, endMinute: 10 },
  { startHour: 13, startMinute: 30, endHour: 14, endMinute: 15 },
  { startHour: 14, startMinute: 25, endHour: 15, endMinute: 10 },
  { startHour: 15, startMinute: 20, endHour: 16, endMinute: 5 },
  { startHour: 16, startMinute: 25, endHour: 17, endMinute: 10 },
  { startHour: 17, startMinute: 20, endHour: 18, endMinute: 5 },
  { startHour: 19, startMinute: 0, endHour: 19, endMinute: 45 },
  { startHour: 19, startMinute: 55, endHour: 20, endMinute: 40 },
  { startHour: 20, startMinute: 50, endHour: 21, endMinute: 35 },
];

function resolveLectures(weeks) {
  try {
    if (!weeks || !Array.isArray(weeks)) {
      console.error("周数据无效", weeks);
      return [];
    }
    
    const events = [];
    
    for (let i = 0; i < weeks.length; i++) {
      const week = weeks[i];
      if (!week || typeof week !== 'object') continue;
      
      const weekNumber = week.weekNumber || i + 1;
      const entries = Array.isArray(week.entries) ? week.entries : [];
      
      for (let j = 0; j < entries.length; j++) {
        try {
          const lecture = entries[j];
          
          // 检查必要的属性是否存在
          if (!lecture.name || !lecture.startTime || !lecture.endTime) continue;
          
          const startDate = new Date(lecture.startTime);
          const endDate = new Date(lecture.endTime);
          
          if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
            console.warn("课程时间无效", lecture);
            continue;
          }
          
          const startIndex = typeof lecture.startSession === 'number' ? lecture.startSession : 0;
          const endIndex = typeof lecture.endSession === 'number' ? lecture.endSession : 0;
          
          if (startIndex < 0 || endIndex < startIndex) {
            console.warn("课程节次无效", lecture);
            continue;
          }
          
          const day = {
            year: startDate.getFullYear(),
            month: startDate.getMonth() + 1,
            day: startDate.getDate()
          };
          const uid = `lecture-${weekNumber}-${j}-${startDate.getTime()}`;
          events.push({
            uid,
            title: lecture.name,
            day,
            startTime: startIndex - 1,
            endTime: endIndex - 1,
            teacher: lecture.lecturer || '',
            classroom: lecture.position ? `${lecture.room || ''}${lecture.position}` : (lecture.room || ''),
            weekNumber,
            dayOfWeek: typeof lecture.dayOfWeek === 'number' ? lecture.dayOfWeek : startDate.getDay()
          });
        } catch (lectureError) {
          console.error("解析课程条目失败", lectureError);
        }
      }
    }
    
    console.log("解析完成的课程数据:", events);
    return events;
  } catch (error) {
    console.error("解析周课程数据失败", error);
    return [];
  }
}

// 添加一个全局变量用于存储当前日期的偏移量
let currentDateOffset = 0;

function renderCurriculum(events) {
  if (!events || !Array.isArray(events) || events.length === 0) {
    const tableDiv = document.querySelector('.curriculum-table-time');
    if (tableDiv) {
      tableDiv.innerHTML = "<div class='curriculum-empty-message'>暂无课程数据</div>";
    }
    return;
  }

  if (!document.getElementById('loading-spinner-style')) {
    const style = document.createElement('style');
    style.id = 'loading-spinner-style';
    style.textContent = `
      .loading-spinner {
        width: 1em;
        height: 1em;
        animation: spin 1s linear infinite;
        vertical-align: middle;
        margin-right: 0.5em;
      }
      @keyframes spin {
        0% { transform: rotate(0deg); }
        100% { transform: rotate(360deg); }
      }
      .date-nav-button {
        background-color: var(--md-primary-fg-color);
        color: white;
        border: none;
        border-radius: 50%;
        width: 2rem;
        height: 2rem;
        font-size: 1.2rem;
        display: flex;
        align-items: center;
        justify-content: center;
        cursor: pointer;
        position: absolute;
        top: 50%;
        transform: translateY(-50%);
        z-index: 10;
        box-shadow: 0 2px 5px rgba(0,0,0,0.2);
        transition: background-color 0.2s;
      }
      .date-nav-button:hover {
        background-color: var(--md-primary-fg-color--dark);
      }
      .date-nav-prev {
        left: 0.5rem;
      }
      .date-nav-next {
        right: 0.5rem;
        transform: translateY(-140%);
      }
      .curriculum-table-container {
        position: relative;
        padding: 0 3rem;
      }
    `;
    document.head.appendChild(style);
  }

  function widthCatcher() {
    if (window.matchMedia('(min-width: 44em)').matches) {
      return 0;
    } else if (window.matchMedia('(min-width: 33em)').matches) {
      return 1;
    } else {
      return 2;
    }
  }
  
  // 获取当前日期并应用偏移量
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  // 根据当前偏移量调整日期
  const displayDate = new Date(today);
  displayDate.setDate(today.getDate() + currentDateOffset);
  
  const dayIndex = (displayDate.getDay() + 6) % 7;
  const monday = new Date(displayDate);
  monday.setDate(displayDate.getDate() - dayIndex);
  
  const weekDates = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    weekDates.push(d);
  }
  
  const recentFiveDates = [];
  for (let i = -1; i < 4; i++) {
    const d = new Date(displayDate);
    d.setDate(displayDate.getDate() + i);
    recentFiveDates.push(d);
  }
  
  const recentThreeDates = [];
  for (let i = 0; i < 3; i++) {
    const d = new Date(displayDate);
    d.setDate(displayDate.getDate() + i);
    recentThreeDates.push(d);
  }
  
  const widthMode = widthCatcher();
  const todayIndex = [dayIndex, 1, 0][widthMode];
  const dates = [weekDates, recentFiveDates, recentThreeDates][widthMode];
  const dateStep = [7, 5, 3][widthMode]; // 日期步长

  const weekDayNames = ["周一", "周二", "周三", "周四", "周五", "周六", "周日"];
  const recentFiveDayNames = ["昨天", "今天", "明天", "后天", "大后天"];
  const recentThreeDayNames = ["今天", "明天", "后天"];
  const dayNames = [weekDayNames, recentFiveDayNames, recentThreeDayNames][widthMode];

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
  
  // 过滤无效的事件
  const validEvents = events.filter(event => 
    event && 
    event.day && 
    event.startTime >= 0 && 
    event.startTime < rows && 
    event.endTime >= event.startTime && 
    event.endTime < rows
  );
  
  validEvents.forEach(event => {
    try {
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
    } catch (error) {
      console.error("处理事件时出错", error, event);
    }
  });
  
  // 创建日期导航函数
  function navigateDate(step) {
    return function() {
      currentDateOffset += step;
      const eventsData = localStorage.getItem("curriculumEvents");
      if (eventsData) {
        const parsedData = JSON.parse(eventsData);
        renderCurriculum(parsedData.curriculumEvents);
      }
    };
  }
  
  const tableDiv = document.querySelector('.curriculum-table-time');
  tableDiv.innerHTML = "";
  
  // 创建一个容器，用于放置表格和导航按钮
  const containerDiv = document.createElement('div');
  containerDiv.classList.add('curriculum-table-container');
  
  // 创建导航按钮
  const prevButton = document.getElementById('curriculum-table-actions-prev');
  prevButton.onclick = navigateDate(-dateStep);
  
  const nextButton = document.getElementById('curriculum-table-actions-next');
  nextButton.onclick = navigateDate(dateStep);
  
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
      if (dates[c].toDateString() === today.toDateString()) {
        td.classList.add('curriculum-table-today');
      }
      if (grid[r][c] && grid[r][c].event) {
        const { event, rowSpan, eventDate } = grid[r][c];
        td.rowSpan = rowSpan;
        td.classList.add('curriculum-table-cell-scheduled');
        const flexbox = document.createElement('div');
        flexbox.classList.add('curriculum-event-flexbox');
        const eventTitle = document.createElement('strong');
        eventTitle.classList.add('curriculum-event-title');
        eventTitle.innerHTML = event.title;
        flexbox.appendChild(eventTitle);
        const eventTeacher = document.createElement('div');
        eventTeacher.classList.add('curriculum-event-teacher');
        eventTeacher.innerHTML = event.teacher;
        flexbox.appendChild(eventTeacher);
        const eventClassroom = document.createElement('div');
        eventClassroom.classList.add('curriculum-event-classroom');
        eventClassroom.innerHTML = event.classroom;
        flexbox.appendChild(eventClassroom);
        const dialog = document.createElement('dialog');
        dialog.id = "eventDialog-" + event.uid;
        dialog.classList.add('curriculum-event-dialog');
        dialog.addEventListener('click', (evt) => {
          if (evt.target === dialog) {
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
  
  // 将表格添加到容器中
  containerDiv.appendChild(table);
  
  // 将容器添加到表格区域
  tableDiv.appendChild(containerDiv);
  
  // 如果当前偏移量为0，添加重置按钮
  const resetDateButton = document.getElementById('curriculum-table-actions-now');
  if (currentDateOffset !== 0) {
    resetDateButton.style.display = "inline"
    resetDateButton.onclick = function() {
      currentDateOffset = 0;
      const eventsData = localStorage.getItem("curriculumEvents");
      if (eventsData) {
        const parsedData = JSON.parse(eventsData);
        renderCurriculum(parsedData.curriculumEvents);
      }
    };
  } else {
    resetDateButton.style.display = "none"
  }
}