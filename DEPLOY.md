# Putting Wellproof online

Two free services:

- **Supabase** hosts the database and logins.
- **Vercel** hosts the website and rebuilds it every time code is pushed to GitHub.

You need two files, made with `npm run deploy:sql`:

- `deploy/schema.sql`: the database structure (both migrations in one file)
- `deploy/sample-data.sql`: the invented demo data. Dates are relative to the day it's generated, so generate it on the day you load it.

## 1. Create the database (Supabase)

1. Sign up at https://supabase.com with your GitHub account.
2. **New project.** Name: `wellproof`. Pick a strong database password and save it in a password manager. Region: the one closest to your users (there may be no African region; a European one is closest to Nigeria).
3. Wait about two minutes for it to finish setting up.

## 2. Create the tables

1. Left sidebar: **SQL Editor**, then **New query**.
2. Paste all of `deploy/schema.sql` and click **Run**. It should say "Success. No rows returned".

## 3. Lock down sign-ups

Accounts are created by us, not by visitors.

1. **Authentication**, then **Sign In / Providers** (may be under Settings): turn off **Allow new users to sign up**.
2. Leave **Email** enabled.

## 4. Create the three demo users

**Authentication**, then **Users**, then **Add user**, then **Create new user**. Tick **Auto Confirm User** each time.

| Email | Password |
| --- | --- |
| admin@sample-operator.example | choose one |
| staff@sample-operator.example | choose one |
| lender@sample-lender.example | choose one |

These are online, so don't reuse the local password `wellproof-demo`.

## 5. Load the sample data

SQL Editor, new query, paste all of `deploy/sample-data.sql`, **Run**. Running it twice is safe; the second run stops without changing anything.

## 6. Copy two values for the website

**Project Settings**, then **API** (or **Data API** / **API Keys**):

- **Project URL**, like `https://abcdefgh.supabase.co`
- **Publishable key** (`sb_publishable_...`), or on older projects the **anon public** key

Both are designed to be public; row-level security protects the data. **Never** copy the secret / service_role key anywhere.

## 7. Publish the website (Vercel)

1. Sign up at https://vercel.com with your GitHub account.
2. **Add New**, then **Project**, then import `Mylesclement/wellproof`. Give Vercel access to that repo if asked.
3. Before deploying, open **Environment Variables** and add:
   - `NEXT_PUBLIC_SUPABASE_URL` = the Project URL
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY` = the publishable key
4. Click **Deploy**. After a couple of minutes you get a link like `wellproof-xyz.vercel.app`.

## 8. Tell Supabase the site's address

**Authentication**, then **URL Configuration**: set **Site URL** to your Vercel link.

## 9. Check it

- The home page, About, Pilot and Contact open without logging in.
- Sign in as each demo user. The lender sees the record but no entry forms.
- Submit a test pilot sign-up, then see it in Supabase under **Table Editor**, then **inquiries**. That table is where all sign-ups and contact messages arrive.

From now on, every push to GitHub updates the live site automatically. Database changes (new migration files) still need to be run in the SQL Editor, in order.
