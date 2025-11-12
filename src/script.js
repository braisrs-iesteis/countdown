"use strict";

const time_elements = [];
const FLOAT = {
  original: null,
  clone: null,
  dragging: false
};

const MOUSE = { x: 0, y: 0 };

function onDrag(){
  const c = FLOAT.clone;
  c.style.left = (MOUSE.x - 165) + "px";
  c.style.top  = (MOUSE.y - 15)  + "px";
}

document.body.addEventListener("mousemove", (e) => {
  MOUSE.x = e.x; MOUSE.y = e.y;
  if(FLOAT.dragging) onDrag();
});


(async () => {



(await (await fetch("/api/events")).json()).forEach((e) => {
  const category = e.category.toLowerCase().replace(" ", "-");

  const wrap = document.createElement("div");
  wrap.classList.add("item-container-wrap");

  wrap.innerHTML = `<div class="item-container">
    <div class="item-content-text">
      <div class="item-category category-${category}">${e.category.toUpperCase()}</div>
      <div class="item-title">${e.title}</div>
      <div class="item-subtitle">${e.subtitle}</div>
    </div>
    <div class="item-time-container"/>
  </div>`;

  const time_container = wrap.getElementsByClassName("item-time-container")[0];
  const container = wrap.getElementsByClassName("item-container")[0];
  container.style.backgroundImage = "url(\"" + e.img + "\")"

  const time_data = {
    datetime: Temporal.PlainDateTime.from(e.datetime),
    container: time_container,
    elements: []
  };

  [ "DAYS", "HOURS", "MINS", "SECS" ].forEach((txt) => {
    const container = document.createElement("div");
    const number = document.createElement("div");
    const text = document.createElement("div");

    time_data.elements.push(number);
    text.innerText = txt;

    container.appendChild(number);
    container.appendChild(text);

    time_container.appendChild(container);
  });

  time_elements.push(time_data);

  document.getElementsByClassName("main")[0].appendChild(wrap);

  function lClick(){
    if(wrap.classList.contains("flip"))
      return;

    FLOAT.original = wrap;
    FLOAT.clone = wrap.cloneNode(true);

    FLOAT.clone.style.position = "fixed";
    FLOAT.clone.style.left = "10px";
    FLOAT.clone.style.top  = "10px";
    FLOAT.clone.style.transitionDuration = "0s";

    onDrag();
    FLOAT.dragging = true;

    document.body.appendChild(FLOAT.clone);
    wrap.classList.add("hidden");
  }

  function rClick(){
    wrap.classList.add("flip")

    fetch("/api/event/", {
      method: "DELETE",
      headers: {
        "Accept": "application/json",
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ id: e.id })
    });
    setTimeout(() => wrap.remove(), 250);
  }

  wrap.addEventListener("mousedown", (ev) => {
    if(ev.button === 0){
      lClick();
    }else if(ev.button === 2){
      rClick();
    }
  });
});

document.body.addEventListener("contextmenu", function(ev) {
  ev.preventDefault();
});

document.addEventListener("mouseup", () => {
  FLOAT.dragging = false;

  if(!FLOAT.original || !FLOAT.clone) return;

  FLOAT.original.classList.remove("hidden");
  FLOAT.original = null;
  FLOAT.clone.remove();
  FLOAT.clone = null;
});

function refreshCountDown(){
  time_elements.forEach((e) => {
    if(e.done) return;

    const dt = e.datetime.since(Temporal.Now.plainDateTimeISO());
    const time = [dt.days, dt.hours, dt.minutes, dt.seconds];

    if(dt.days <= 0 && dt.hours <= 0 && dt.minutes <= 0 && dt.seconds <= 0){
      e.done = true;
      e.container.style.display = "block";
      e.container.innerText = "OUT NOW";
      return;
    }

    for(let i = 0; i < time.length; ++i)
      e.elements[i].innerText = time[i];
  });

  if(!FLOAT.original || !FLOAT.clone) return;
  FLOAT.clone.getElementsByClassName("item-time-container")[0].innerHTML =
    FLOAT.original.getElementsByClassName("item-time-container")[0].innerHTML
}

setInterval(refreshCountDown, 1000);
refreshCountDown();



})();