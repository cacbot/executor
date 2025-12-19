require("dotenv").config()

const express = require("express")
const session = require("express-session")
const bodyParser = require("body-parser")
const path = require("path")
const bcrypt = require("bcrypt")
const { Resend } = require("resend")

const app = express()
const resend = new Resend(process.env.RESEND_API_KEY)

const PORT = process.env.PORT || 3000

app.use(bodyParser.urlencoded({ extended: false }))
app.use(express.json())

app.use(session({
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: { secure: false, sameSite: "lax" }
}))

app.use(express.static(path.join(__dirname, "public")))

function requireAuth(req, res, next) {
  if (!req.session.authenticated) return res.redirect("/")
  next()
}

app.get("/", (req, res) => res.sendFile(path.join(__dirname, "public", "login.html")))

app.post("/login", (req, res) => {
  const { username, password } = req.body
  if (
    username === process.env.ADMIN_USERNAME &&
    password === process.env.ADMIN_PASSWORD
  ) {
    req.session.authenticated = true
    return res.redirect("/exec")
  }
  res.redirect("/?error=1")
})

app.get("/forgot", (req, res) => res.sendFile(path.join(__dirname, "public", "forgot.html")))

app.post("/forgot", async (req, res) => {
  const code = Math.floor(100000 + Math.random() * 900000).toString()
  req.session.resetCode = code
  req.session.resetTime = Date.now()

  try {
    const { data, error } = await resend.emails.send({
      from: process.env.EMAIL_FROM,
      to: "cacbot1@gmail.com",
      subject: "Executor Reset Code",
      html: `<p>Your reset code is: <strong style="font-size:20px;">${code}</strong></p><p>Valid for 1 hour.</p>`
    })
    if (error) console.error("Resend error:", error)
    else console.log("Reset code sent:", data.id)
  } catch (err) {
    console.error("Email failed:", err)
  }

  res.redirect("/reset")
})

app.get("/reset", (req, res) => res.sendFile(path.join(__dirname, "public", "reset.html")))

app.post("/reset", (req, res) => {
  const { code, password } = req.body

  if (
    req.session.resetCode === code &&
    Date.now() - req.session.resetTime < 3600000
  ) {
    process.env.ADMIN_PASSWORD = password
    console.log("Password updated successfully")
    delete req.session.resetCode
    delete req.session.resetTime
    res.redirect("/")
  } else {
    res.redirect("/reset?error=1")
  }
})

app.use(requireAuth)

app.get("/exec", (req, res) => res.sendFile(path.join(__dirname, "public", "exec.html")))
app.get("/settings", (req, res) => res.sendFile(path.join(__dirname, "public", "settings.html")))

app.listen(PORT, () => console.log(`Executor running on port ${PORT}`))