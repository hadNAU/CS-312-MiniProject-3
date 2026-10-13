import "dotenv/config";
import express from "express";
import session from "express-session";
import pg from "pg";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { hashPassword, verifyPassword } from "./lib/passwords.js";

const app = express();
const PORT = Number(process.env.PORT || 3000);
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const { Pool } = pg;

// PostgreSQL connection (values are supplied in your .env file).
const db = new Pool({
    host: process.env.PGHOST || "localhost",
    port: Number(process.env.PGPORT || 5432),
    database: process.env.PGDATABASE || "BlogDB",
    user: process.env.PGUSER || "postgres",
    password: process.env.PGPASSWORD,
    connectionTimeoutMillis: 5000
});

db.on("error", (error) => console.error("Idle PostgreSQL connection error:", error));

app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));
app.use(express.urlencoded({ extended: false, limit: "32kb" }));
app.use(express.static(path.join(__dirname, "public")));

if (!process.env.SESSION_SECRET || process.env.SESSION_SECRET.length < 24) {
    console.error("Set SESSION_SECRET to a random string of at least 24 characters in .env");
    process.exit(1);
}

app.use(session({
    name: "blog.sid",
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: {
        httpOnly: true,
        sameSite: "lax",
        secure: process.env.NODE_ENV === "production",
        maxAge: 1000 * 60 * 60 * 24
    }
}));

app.use((req, res, next) => {
    res.locals.currentUser = req.session.user || null;
    next();
});

function requireLogin(req, res, next) {
    if (!req.session.user) return res.redirect("/signin");
    next();
}

function cleanInput(value, maxLength) {
    if (typeof value !== "string") return null;
    const cleaned = value.trim();
    if (!cleaned || cleaned.length > maxLength) return null;
    return cleaned;
}

function getBlogId(rawId) {
    if (!/^\d+$/.test(rawId)) return null;
    const id = Number(rawId);
    return Number.isSafeInteger(id) && id > 0 ? id : null;
}

// Step 6: The homepage displays blogs loaded from PostgreSQL.
app.get("/", async (req, res) => {
    const result = await db.query(
        `SELECT blog_id, creator_name, creator_user_id, title, body, date_created
         FROM blogs
         ORDER BY date_created DESC, blog_id DESC`
    );
    res.render("index", {
        posts: result.rows,
        error: req.query.error === "invalid" ? "Enter a title (up to 255 characters) and a post (up to 10,000 characters)." : null
    });
});

// Step 4: Signup.
app.get("/signup", (req, res) => {
    res.render("signup", { error: null, values: {} });
});

app.post("/signup", async (req, res) => {
    const userId = cleanInput(req.body.user_id, 255);
    const name = cleanInput(req.body.name, 255);
    const password = req.body.password;
    const values = { user_id: userId || "", name: name || "" };

    if (!userId || !name || typeof password !== "string" ||
        password.length < 8 || Buffer.byteLength(password, "utf8") > 128) {
        return res.status(400).render("signup", {
            error: "Enter a user ID, name, and password (8–128 bytes).",
            values
        });
    }

    const existing = await db.query("SELECT user_id FROM users WHERE user_id = $1", [userId]);
    if (existing.rowCount > 0) {
        return res.status(409).render("signup", {
            error: "That user ID is already taken. Please choose another.",
            values
        });
    }

    try {
        const passwordHash = await hashPassword(password);
        await db.query(
            "INSERT INTO users (user_id, password, name) VALUES ($1, $2, $3)",
            [userId, passwordHash, name]
        );
    } catch (error) {
        // Also handle simultaneous signup attempts for the same ID.
        if (error.code === "23505") {
            return res.status(409).render("signup", {
                error: "That user ID is already taken. Please choose another.",
                values
            });
        }
        throw error;
    }

    res.redirect("/signin?created=1");
});

// Step 4: Signin, using SELECT ... WHERE and checking the password hash.
app.get("/signin", (req, res) => {
    res.render("signin", { error: null, created: req.query.created === "1" });
});

app.post("/signin", async (req, res, next) => {
    const userId = cleanInput(req.body.user_id, 255);
    const password = req.body.password;

    if (!userId || typeof password !== "string") {
        return res.status(401).render("signin", { error: "Incorrect user ID or password.", created: false });
    }

    const result = await db.query(
        "SELECT user_id, password, name FROM users WHERE user_id = $1",
        [userId]
    );
    const user = result.rows[0];

    if (!user || !(await verifyPassword(password, user.password))) {
        return res.status(401).render("signin", { error: "Incorrect user ID or password.", created: false });
    }

    // Regenerate the session when login succeeds (prevents session fixation).
    req.session.regenerate((error) => {
        if (error) return next(error);
        req.session.user = { userId: user.user_id, name: user.name };
        req.session.save((saveError) => {
            if (saveError) return next(saveError);
            res.redirect("/");
        });
    });
});

app.post("/signout", requireLogin, (req, res, next) => {
    req.session.destroy((error) => {
        if (error) return next(error);
        res.clearCookie("blog.sid");
        res.redirect("/signin");
    });
});

// Step 5: Create posts. The author always comes from the logged-in session.
app.post("/posts", requireLogin, async (req, res) => {
    const title = cleanInput(req.body.title, 255);
    const body = cleanInput(req.body.content, 10000);
    if (!title || !body) return res.redirect("/?error=invalid");

    await db.query(
        `INSERT INTO blogs (creator_name, creator_user_id, title, body, date_created)
         VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP)`,
        [req.session.user.name, req.session.user.userId, title, body]
    );
    res.redirect("/");
});

// Step 7: Only the blog's owner can open its edit form.
app.get("/edit/:id", requireLogin, async (req, res) => {
    const id = getBlogId(req.params.id);
    if (id === null) return res.status(404).send("Blog post not found.");

    const result = await db.query(
        "SELECT blog_id, creator_user_id, title, body FROM blogs WHERE blog_id = $1",
        [id]
    );
    const post = result.rows[0];
    if (!post) return res.status(404).send("Blog post not found.");
    if (post.creator_user_id !== req.session.user.userId) {
        return res.status(403).send("You can only edit your own posts.");
    }
    res.render("edit", { post, error: null });
});

// Step 7: UPDATE also checks ownership in the SQL WHERE clause.
app.post("/edit/:id", requireLogin, async (req, res) => {
    const id = getBlogId(req.params.id);
    if (id === null) return res.status(404).send("Blog post not found.");

    const title = cleanInput(req.body.title, 255);
    const body = cleanInput(req.body.content, 10000);
    if (!title || !body) {
        return res.status(400).render("edit", {
            post: { blog_id: id, title: req.body.title || "", body: req.body.content || "" },
            error: "Enter a title (up to 255 characters) and a post (up to 10,000 characters)."
        });
    }

    const result = await db.query(
        `UPDATE blogs SET title = $1, body = $2
         WHERE blog_id = $3 AND creator_user_id = $4 RETURNING blog_id`,
        [title, body, id, req.session.user.userId]
    );
    if (result.rowCount === 0) return res.status(404).send("Post not found or you are not its owner.");
    res.redirect("/");
});

// Step 8: DELETE is restricted to the post's owner by SQL WHERE.
app.post("/delete/:id", requireLogin, async (req, res) => {
    const id = getBlogId(req.params.id);
    if (id === null) return res.status(404).send("Blog post not found.");

    const result = await db.query(
        "DELETE FROM blogs WHERE blog_id = $1 AND creator_user_id = $2 RETURNING blog_id",
        [id, req.session.user.userId]
    );
    if (result.rowCount === 0) return res.status(404).send("Post not found or you are not its owner.");
    res.redirect("/");
});

app.use((req, res) => res.status(404).send("Page not found."));
app.use((error, req, res, next) => {
    console.error(error);
    if (res.headersSent) return next(error);
    res.status(500).send("Something went wrong. Please try again.");
});

// Fail early if the DB is not configured instead of starting a broken website.
try {
    await db.query("SELECT 1 FROM users LIMIT 1");
    await db.query("SELECT 1 FROM blogs LIMIT 1");
    app.listen(PORT, () => console.log(`Blog running at http://localhost:${PORT}`));
} catch (error) {
    console.error("Could not connect to the blog tables in PostgreSQL.");
    console.error(error.message);
    console.error("Check .env, create BlogDB, and run sql/schema.sql and sql/seed.sql in pgAdmin.");
    await db.end();
    process.exitCode = 1;
}
