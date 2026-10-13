-- Run this in pgAdmin's Query Tool after creating the "BlogDB" database.
-- The users table must be created before blogs because blogs has a foreign key.

CREATE TABLE IF NOT EXISTS users (
    user_id VARCHAR(255) PRIMARY KEY,
    password VARCHAR(255) NOT NULL,
    name VARCHAR(255) NOT NULL
);

CREATE TABLE IF NOT EXISTS blogs (
    blog_id SERIAL PRIMARY KEY,
    creator_name VARCHAR(255) NOT NULL,
    creator_user_id VARCHAR(255) NOT NULL,
    title VARCHAR(255) NOT NULL,
    body TEXT NOT NULL,
    date_created TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_blog_creator
        FOREIGN KEY (creator_user_id) REFERENCES users(user_id)
);

CREATE INDEX IF NOT EXISTS idx_blogs_newest ON blogs (date_created DESC, blog_id DESC);
CREATE INDEX IF NOT EXISTS idx_blogs_creator ON blogs (creator_user_id);
