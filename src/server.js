#!/bin/bun run
"use strict";

import path from "path";
import express from "express";
import { parse } from "node-html-parser";


// https://gist.github.com/fnky/458719343aabd01cfb17a3a4f7296797
const TERM_RED     = "\x1b[1;31m";
const TERM_GREEN   = "\x1b[1;32m";
const TERM_YELLOW  = "\x1b[1;33m";
const TERM_BLUE    = "\x1b[1;34m";
const TERM_MAGENTA = "\x1b[1;35m";

const TERM_RESET   = "\x1b[0m";

const { DEBUG, OFFLINE, PORT } = (() => {
  let DEBUG = true;
  let OFFLINE = true;
  let PORT = 8888;

  const argv = process.argv;
  for(let i = 2; i < argv.length; ++i){
    if(argv[i] == "--port"){
      ++i;
      if(!argv[i]){
        console.error("Port number is missing");
        process.exit(1);
      }
      PORT = argv[++i];

    }else if(argv[i] == "--offline"){
      OFFLINE_MODE = true;

    }else if(argv[i] == "--online"){
      OFFLINE = false;

    }else if(argv[i] == "--debug"){
      DEBUG = true;
    }
  }

  return { DEBUG, OFFLINE, PORT };
})();

const P = {}
P.SRC = import.meta.dirname;
P.DATABASE = path.resolve(P.SRC + "/../data/database.db");
P.THIRD_PARTY = path.resolve(P.SRC + "/../third_party");

const db = await (async () => {
  const RUNTIME = globalThis.navigator.userAgent.split("/")[0].toLowerCase();
  const modSqlite = ({
    "node.js": "node:sqlite",
    "bun": "bun:sqlite",
  })[RUNTIME];

  if(!modSqlite){
    console.error("Unsuported runtime: " + RUNTIME);
    process.exit(1);
  }

  const s = await import(modSqlite);
  return new (s.DatabaseSync ? s.DatabaseSync : s.Database)(P.DATABASE);
})();

db.exec(/* SQL */
  `CREATE TABLE IF NOT EXISTS countdown (
    title TEXT,
    subtitle TEXT,
    category TEXT,
    datetime TEXT,
    img TEXT,
      UNIQUE(title, subtitle))`.replace(/[ \n]+/, " "));

const T = {}
T.countdown = {
  select: () => {
    return T.countdown.__prepare_select.all();
  },
  insert: (t) => {
    return T.countdown.__prepare_insert.all(t.title, t.subtitle, t.category, t.datetime, t.img);
  },
  update: (t) => {
    return T.countdown.__prepare_update.all(t.category, t.datetime, t.img, t.title, t.subtitle);
  },
  delete: (t) => {
    return T.countdown.__prepare_delete.all(t.title, t.subtitle);
  },


  __prepare_select: db.prepare(/* SQL */
    "SELECT title, subtitle, category, datetime, img FROM countdown"),

  __prepare_insert: db.prepare(/* SQL */
    `INSERT OR IGNORE INTO
      countdown(title, subtitle, category, datetime, img) 
        VALUES(?, ?, ?, ?, ?)`.replace(/[ \n]+/, " ")),

  __prepare_update: db.prepare(/* SQL */
    `UPDATE countdown
      SET category=?, datetime=?, img=?
        WHERE title=? AND subtitle=?`.replace(/[ \n]+/, " ")),

  __prepare_delete: db.prepare(/* SQL */
    "DELETE FROM countdown WHERE title=? and subtitle=?")
};

const app = express();
app.use(express.json());

const GET = !DEBUG ? (p, c) => app.get(p, c) : (path, callback) => {
  app.get(path, (req, res) => {
    const strBody = req.body ? (" :: " + JSON.stringify(req.body)) : "";
    console.log(TERM_GREEN + "GET" + TERM_RESET +  " " + req.originalUrl + strBody);
    callback(req, res);
  });
};

const POST = !DEBUG ? (p, c) => app.post(p ,c) : (path, callback) => {
  app.post(path, (req, res) => {
    const strBody = req.body ? (" :: " + JSON.stringify(req.body)) : "";
    console.log(TERM_BLUE + "POST" + TERM_RESET +  " " + req.originalUrl + strBody);
    callback(req, res);
  });
};

const DELETE = !DEBUG ? (p, c) => app.delete(p, c) : (path, callback) => {
  app.delete(path, (req, res) => {
    const strBody = req.body ? (" :: " + JSON.stringify(req.body)) : "";
    console.log(TERM_RED + "DELETE" + TERM_RESET +  " " + req.originalUrl + strBody);
    callback(req, res);
  });
};

GET("/",            (_, res) => res.sendFile(P.SRC + "/index.html"));
GET("/index.html",  (_, res) => res.sendFile(P.SRC + "/index.html"));
GET("/script.js",   (_, res) => res.sendFile(P.SRC + "/script.js"));
GET("/temporal.js", (_, res) => res.sendFile(P.THIRD_PARTY + "/temporal@0.3.0.min.js"));
GET("/api/events",  (_, res) => res.json(T.countdown.select()));

POST("/api/event", (req, res) => {
  const { title, subtitle, category, datetime, img } = req.body;
  const t = { title, subtitle, category, datetime, img };
  T.countdown.insert(t);
  res.status(200).json({ "status": "OK" });
});

DELETE("/api/event/", (req, res) => {
  const { title, subtitle } = req.body;
  const t = { title, subtitle };
  T.countdown.delete(t);
  res.status(200).json({ "status": "OK" });
});

if(!OFFLINE){
  const urls = [
    "https://yourcountdown.to/",
    "https://yourcountdown.to/trending",
  ];
  for(let i = 2; i < 10; ++i)
    urls.push("https://yourcountdown.to/trending?page=" + i);

  for(const url of urls) {
    const html = await (await fetch(url)).text();
    Array.from(parse(html).querySelectorAll(".countdown-item")).forEach((e) => {
      let c = e.querySelectorAll(".category")[0];
      c = c ? c.innerText : "other";
      T.countdown.insert({
        title: e.querySelectorAll(".title")[0].innerText,
        category: c,
        subtitle: e.querySelectorAll(".subtitle")[0].innerText,
        datetime: e.querySelectorAll(".countdown")[0].getAttribute("data-date"),
        img: e.querySelectorAll("img")[0].getAttribute("src")
      });
    })
  }
}

const server = app.listen(PORT, () => {
  console.log("Server running at " + TERM_YELLOW + "http://localhost:" + PORT + "/" + TERM_RESET);

  process.on("SIGINT", () => {
    console.log();

    server.close();
    db.close();

    console.log("Server stopped");
    process.exit(0);
  });
});
