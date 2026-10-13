-- Run AFTER sql/schema.sql in the BlogDB Query Tool.
-- The demo passwords are documented in README.md. Passwords in this file are scrypt hashes.

INSERT INTO users (user_id, password, name) VALUES
    ('alex', '495c3b2ca63aa6b34e7081dabefaeb75:6ee620746aa11f059fa3eaa8b93608c38d66ac10d934f73b697db3e0edaa70d034a74e484e6268d784d6bc94a49f4ac52ebafc6631244d1dc8a4fe7a4da1ed38', 'Alex Morgan'),
    ('jordan', '2c06f3a6dadaeeab9e58fe53f9da271f:595de138edcd3c03bd74d6727ec87d54b77d0083b8453da1789359ccfdbd1c2b48f05f2d54bd738a9fd508108f9662022be2321fc33dd6c6ae64978c858fe01f', 'Jordan Lee'),
    ('taylor', '7016ae7452f9da85c175b3cb19d737c5:99785bee910977896d26c4bcff51788e3385098dff0ef29dd0b32406e985bae2243c23c00431fad320ced5bbb500f177ec2fbec33e135dc4f8ead6d0ca84b487', 'Taylor Rivera')
ON CONFLICT (user_id) DO NOTHING;

INSERT INTO blogs (blog_id, creator_name, creator_user_id, title, body, date_created) VALUES
    ('1', 'Alex Morgan', 'alex', 'Why I Started Learning SQL', 'I used to store everything in arrays, but once my project needed to remember posts after restarting, a database made much more sense. PostgreSQL lets me query, update, and organize information without losing it when the server stops.', '2026-10-01 09:15:00'),
    ('2', 'Jordan Lee', 'jordan', 'A Weekend in Flagstaff', 'I spent Saturday exploring local trails and finding a quiet place to read. The best part was getting away from my screen for a few hours. Next weekend, I want to try a longer hike.', '2026-10-03 14:40:00'),
    ('3', 'Taylor Rivera', 'taylor', 'Three Habits That Help Me Study', 'First, I split big assignments into smaller steps. Second, I test each feature as I finish it. Third, I write short notes about what went wrong so I can fix similar issues faster next time.', '2026-10-05 18:10:00'),
    ('4', 'Alex Morgan', 'alex', 'Understanding Foreign Keys', 'A foreign key connects a row in one table to a row in another table. For our blog, creator_user_id links each post to a real user. It keeps our relationships consistent and makes it easier to decide who may edit a post.', '2026-10-07 11:25:00'),
    ('5', 'Jordan Lee', 'jordan', 'Small Projects Teach Big Lessons', 'A blog app looks simple, but it covers a surprising amount: routing, HTML forms, authentication, SQL queries, and authorization. Building these pieces together helps me understand how full-stack applications work.', '2026-10-09 16:55:00')
ON CONFLICT (blog_id) DO NOTHING;

-- Since the seed inserts specific IDs, move the SERIAL counter past the largest blog ID.
SELECT setval(pg_get_serial_sequence('blogs', 'blog_id'), (SELECT MAX(blog_id) FROM blogs));
