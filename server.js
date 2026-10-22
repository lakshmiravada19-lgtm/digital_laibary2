require("dotenv").config();
const express = require("express");
const cors = require("cors");
const db = require("./db");

const app = express();
app.use(cors({ origin: process.env.FRONTEND_ORIGIN || "http://localhost:5173" }));
app.use(express.json());

const asyncRoute = (handler) => (req, res, next) =>
  Promise.resolve(handler(req, res, next)).catch(next);

app.get("/api/health", asyncRoute(async (_req, res) => {
  await db.query("SELECT 1");
  res.json({ status: "ok", message: "Digital Library API is running" });
}));

app.get("/api/dashboard", asyncRoute(async (_req, res) => {
  const [[{ users }]] = await db.query("SELECT COUNT(*) AS users FROM Users");
  const [[{ books }]] = await db.query("SELECT COALESCE(SUM(Total_Copies),0) AS books FROM Books");
  const [[{ borrowed }]] = await db.query("SELECT COUNT(*) AS borrowed FROM Borrowing WHERE Return_Date IS NULL");
  const [[{ pending_fines }]] = await db.query("SELECT COUNT(*) AS pending_fines FROM Fines WHERE Payment_Status='Pending'");
  res.json({ users, books, borrowed, pending_fines });
}));

app.get("/api/books", asyncRoute(async (req, res) => {
  const search = `%${String(req.query.search || "").trim()}%`;
  const [rows] = await db.execute(
    `SELECT b.Book_ID, b.Title, b.Author_ID, a.Author_Name AS Author,
            b.Category, b.ISBN, b.Total_Copies, b.Available_Copies
     FROM Books b LEFT JOIN Authors a ON a.Author_ID=b.Author_ID
     WHERE b.Title LIKE ? OR a.Author_Name LIKE ? OR b.Category LIKE ? OR b.ISBN LIKE ?
     ORDER BY b.Title`,
    [search, search, search, search]
  );
  res.json(rows);
}));

app.post("/api/books", asyncRoute(async (req, res) => {
  const { title, author_id, category, isbn, total_copies = 1 } = req.body;
  const copies = Number(total_copies);
  if (!String(title || "").trim()) return res.status(400).json({ error: "Title is required" });
  if (!Number.isInteger(copies) || copies < 1) return res.status(400).json({ error: "total_copies must be a positive integer" });
  const [result] = await db.execute(
    "INSERT INTO Books (Title, Author_ID, Category, ISBN, Total_Copies, Available_Copies) VALUES (?, ?, ?, ?, ?, ?)",
    [title.trim(), author_id || null, category || null, isbn || null, copies, copies]
  );
  res.status(201).json({ message: "Book added", Book_ID: result.insertId });
}));

app.delete("/api/books/:id", asyncRoute(async (req, res) => {
  const [active] = await db.execute("SELECT COUNT(*) AS count FROM Borrowing WHERE Book_ID=? AND Return_Date IS NULL", [req.params.id]);
  if (active[0].count > 0) return res.status(409).json({ error: "This book has an active borrowing record and cannot be deleted." });
  await db.execute("DELETE FROM Books WHERE Book_ID=?", [req.params.id]);
  res.json({ message: "Book deleted" });
}));

app.get("/api/authors", asyncRoute(async (_req, res) => {
  const [rows] = await db.query("SELECT Author_ID, Author_Name FROM Authors ORDER BY Author_Name");
  res.json(rows);
}));

app.post("/api/authors", asyncRoute(async (req, res) => {
  const name = String(req.body.author_name || "").trim();
  if (!name) return res.status(400).json({ error: "Author name is required" });
  const [result] = await db.execute("INSERT INTO Authors (Author_Name) VALUES (?)", [name]);
  res.status(201).json({ message: "Author added", Author_ID: result.insertId });
}));

app.get("/api/users", asyncRoute(async (_req, res) => {
  const [rows] = await db.query("SELECT User_ID, Name, Email, Phone, Created_At FROM Users ORDER BY Name");
  res.json(rows);
}));

app.post("/api/users", asyncRoute(async (req, res) => {
  const name = String(req.body.name || "").trim();
  const email = String(req.body.email || "").trim().toLowerCase();
  const phone = String(req.body.phone || "").trim();
  if (!name || !email) return res.status(400).json({ error: "Name and email are required" });
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return res.status(400).json({ error: "Enter a valid email address" });
  const [result] = await db.execute("INSERT INTO Users (Name, Email, Phone) VALUES (?, ?, ?)", [name, email, phone || null]);
  res.status(201).json({ message: "User registered", User_ID: result.insertId });
}));

app.get("/api/borrowing", asyncRoute(async (_req, res) => {
  const [rows] = await db.query(
    `SELECT br.Borrow_ID, br.User_ID, u.Name AS User_Name, br.Book_ID,
            b.Title, br.Issue_Date, br.Due_Date, br.Return_Date
     FROM Borrowing br JOIN Users u ON u.User_ID=br.User_ID
     JOIN Books b ON b.Book_ID=br.Book_ID
     ORDER BY br.Issue_Date DESC, br.Borrow_ID DESC`
  );
  res.json(rows);
}));

app.post("/api/borrowing", asyncRoute(async (req, res) => {
  const userId = Number(req.body.user_id);
  const bookId = Number(req.body.book_id);
  const days = Number(req.body.loan_days || 14);
  if (!Number.isInteger(userId) || !Number.isInteger(bookId) || !Number.isInteger(days) || days < 1 || days > 90) {
    return res.status(400).json({ error: "Valid user_id, book_id and loan_days (1–90) are required" });
  }
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();
    const [users] = await conn.execute("SELECT User_ID FROM Users WHERE User_ID=? FOR UPDATE", [userId]);
    if (!users.length) { await conn.rollback(); return res.status(404).json({ error: "User not found" }); }
    const [books] = await conn.execute("SELECT Book_ID, Available_Copies FROM Books WHERE Book_ID=? FOR UPDATE", [bookId]);
    if (!books.length) { await conn.rollback(); return res.status(404).json({ error: "Book not found" }); }
    if (books[0].Available_Copies < 1) { await conn.rollback(); return res.status(409).json({ error: "No copies are currently available" }); }
    const [result] = await conn.execute(
      "INSERT INTO Borrowing (User_ID, Book_ID, Issue_Date, Due_Date) VALUES (?, ?, CURRENT_DATE, DATE_ADD(CURRENT_DATE, INTERVAL ? DAY))",
      [userId, bookId, days]
    );
    await conn.execute("UPDATE Books SET Available_Copies=Available_Copies-1 WHERE Book_ID=?", [bookId]);
    await conn.commit();
    res.status(201).json({ message: "Book issued successfully", Borrow_ID: result.insertId });
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}));

app.patch("/api/borrowing/:id/return", asyncRoute(async (req, res) => {
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();
    const [records] = await conn.execute("SELECT * FROM Borrowing WHERE Borrow_ID=? FOR UPDATE", [req.params.id]);
    if (!records.length) { await conn.rollback(); return res.status(404).json({ error: "Borrowing record not found" }); }
    const record = records[0];
    if (record.Return_Date) { await conn.rollback(); return res.status(409).json({ error: "This book has already been returned" }); }

    await conn.execute("UPDATE Borrowing SET Return_Date=CURRENT_DATE WHERE Borrow_ID=?", [req.params.id]);
    await conn.execute("UPDATE Books SET Available_Copies=LEAST(Total_Copies, Available_Copies+1) WHERE Book_ID=?", [record.Book_ID]);

    const [[late]] = await conn.execute("SELECT GREATEST(DATEDIFF(CURRENT_DATE, Due_Date),0) AS days_late FROM Borrowing WHERE Borrow_ID=?", [req.params.id]);
    const fineAmount = Number(late.days_late) * 5;
    if (fineAmount > 0) {
      await conn.execute(
        "INSERT INTO Fines (User_ID, Borrow_ID, Amount, Payment_Status) VALUES (?, ?, ?, 'Pending')",
        [record.User_ID, record.Borrow_ID, fineAmount]
      );
    }
    await conn.commit();
    res.json({ message: "Book returned successfully", days_late: late.days_late, fine_amount: fineAmount });
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}));

app.get("/api/fines", asyncRoute(async (_req, res) => {
  const [rows] = await db.query(
    `SELECT f.Fine_ID, f.User_ID, u.Name AS User_Name, f.Borrow_ID,
            f.Amount, f.Payment_Status, f.Created_At
     FROM Fines f JOIN Users u ON u.User_ID=f.User_ID
     ORDER BY f.Created_At DESC`
  );
  res.json(rows);
}));

app.patch("/api/fines/:id/pay", asyncRoute(async (req, res) => {
  const [result] = await db.execute("UPDATE Fines SET Payment_Status='Paid' WHERE Fine_ID=? AND Payment_Status='Pending'", [req.params.id]);
  if (!result.affectedRows) return res.status(404).json({ error: "Pending fine not found" });
  res.json({ message: "Fine marked as paid" });
}));

app.use((req, res) => res.status(404).json({ error: "API endpoint not found" }));

app.use((err, _req, res, _next) => {
  console.error(err);
  if (err.code === "ER_DUP_ENTRY") return res.status(409).json({ error: "A record with this email or ISBN already exists" });
  if (err.code === "ER_NO_REFERENCED_ROW_2") return res.status(400).json({ error: "The selected related record does not exist" });
  res.status(500).json({ error: "Internal server error" });
});

const port = Number(process.env.PORT || 5000);
app.listen(port, () => console.log(`Digital Library API running at http://localhost:${port}`));
