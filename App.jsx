import { useCallback, useEffect, useState } from "react";

const API = import.meta.env.VITE_API_URL || "http://localhost:5000/api";
const initialForms = {
  books: { title: "", author_id: "", category: "", isbn: "", total_copies: 1 },
  authors: { author_name: "" },
  users: { name: "", email: "", phone: "" },
  borrowing: { user_id: "", book_id: "", loan_days: 14 }
};

async function request(path, options = {}) {
  const response = await fetch(`${API}${path}`, {
    ...options,
    headers: { "Content-Type": "application/json", ...(options.headers || {}) }
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || "Request failed");
  return data;
}

function Stat({ label, value, note }) {
  return <div className="stat"><span>{label}</span><strong>{value ?? "—"}</strong><small>{note}</small></div>;
}

export default function App() {
  const [page, setPage] = useState("Dashboard");
  const [dashboard, setDashboard] = useState({});
  const [books, setBooks] = useState([]);
  const [authors, setAuthors] = useState([]);
  const [users, setUsers] = useState([]);
  const [borrowing, setBorrowing] = useState([]);
  const [fines, setFines] = useState([]);
  const [search, setSearch] = useState("");
  const [forms, setForms] = useState(initialForms);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const [d, b, a, u, br, f] = await Promise.all([
        request("/dashboard"), request(`/books?search=${encodeURIComponent(search)}`),
        request("/authors"), request("/users"), request("/borrowing"), request("/fines")
      ]);
      setDashboard(d); setBooks(b); setAuthors(a); setUsers(u); setBorrowing(br); setFines(f);
      setError("");
    } catch (e) { setError(`${e.message}. Check that MySQL and the backend are running.`); }
  }, [search]);

  useEffect(() => { load(); }, [load]);

  function updateForm(group, key, value) {
    setForms(current => ({ ...current, [group]: { ...current[group], [key]: value } }));
  }

  async function submit(event, group, endpoint) {
    event.preventDefault(); setBusy(true); setMessage(""); setError("");
    try {
      const body = { ...forms[group] };
      if (group === "books") {
        body.author_id = body.author_id ? Number(body.author_id) : null;
        body.total_copies = Number(body.total_copies);
      }
      if (group === "borrowing") {
        body.user_id = Number(body.user_id); body.book_id = Number(body.book_id);
        body.loan_days = Number(body.loan_days);
      }
      await request(endpoint, { method: "POST", body: JSON.stringify(body) });
      setMessage("Saved successfully.");
      setForms(current => ({ ...current, [group]: initialForms[group] }));
      await load();
    } catch (e) { setError(e.message); }
    finally { setBusy(false); }
  }

  async function action(path, method = "PATCH") {
    setMessage(""); setError("");
    try { const result = await request(path, { method }); setMessage(result.message || "Updated successfully."); await load(); }
    catch (e) { setError(e.message); }
  }

  const nav = ["Dashboard", "Books", "Authors", "Users", "Borrowing", "Fines"];

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand"><div className="brand-icon">DL</div><div><b>Digital Library</b><small>Management System</small></div></div>
        <div className="nav-label">WORKSPACE</div>
        {nav.map(item => <button key={item} className={`nav-item ${page === item ? "active" : ""}`} onClick={() => setPage(item)}>
          <span className="nav-dot">{({Dashboard:"▦",Books:"▤",Authors:"✎",Users:"♙",Borrowing:"⇄",Fines:"₹"})[item]}</span>{item}
        </button>)}
        <div className="sidebar-bottom"><span className="status-dot"></span> Library system <small>Local project</small></div>
      </aside>

      <main className="main">
        <header className="topbar">
          <div><span className="eyebrow">LIBRARY WORKSPACE</span><h1>{page}</h1></div>
          <div className="top-right"><span className="online"><i /> API connected when server is running</span><div className="avatar">DL</div></div>
        </header>

        {message && <div className="notice success">{message}<button onClick={() => setMessage("")}>×</button></div>}
        {error && <div className="notice danger">{error}<button onClick={() => setError("")}>×</button></div>}

        {page === "Dashboard" && <>
          <section className="welcome"><div><span className="pill">LIBRARY OVERVIEW</span><h2>Knowledge at your fingertips.</h2><p>Manage your collection, members, borrowing activity, and fines in one place.</p></div><div className="welcome-art"><div className="book-stack"><span></span><span></span><span></span><span></span></div><div className="art-circle">✦</div></div></section>
          <section className="stats">
            <Stat label="REGISTERED USERS" value={dashboard.users} note="Library members"/>
            <Stat label="TOTAL BOOK COPIES" value={dashboard.books} note="Across all titles"/>
            <Stat label="CURRENTLY BORROWED" value={dashboard.borrowed} note="Awaiting return"/>
            <Stat label="PENDING FINES" value={dashboard.pending_fines} note="Need payment"/>
          </section>
          <section className="panel"><div className="panel-heading"><div><h3>Recently borrowed books</h3><p>Latest borrowing activity</p></div><button className="text-button" onClick={() => setPage("Borrowing")}>View all →</button></div><BorrowTable rows={borrowing.slice(0, 5)} onReturn={id => action(`/borrowing/${id}/return`)} compact /></section>
          <section className="panel quick-panel"><div className="panel-heading"><div><h3>Quick actions</h3><p>Common library tasks</p></div></div><div className="quick-actions"><button onClick={() => setPage("Books")}><b>＋</b><span>Add or browse books</span><small>Manage the catalog</small></button><button onClick={() => setPage("Users")}><b>♙</b><span>Register a member</span><small>Manage library users</small></button><button onClick={() => setPage("Borrowing")}><b>⇄</b><span>Issue a book</span><small>Start a borrowing record</small></button></div></section>
        </>}

        {page === "Books" && <><section className="panel"><div className="panel-heading"><div><h3>Book catalog</h3><p>Search and manage library titles</p></div><input className="search" placeholder="Search title, author, ISBN..." value={search} onChange={e => setSearch(e.target.value)} /></div><div className="table-wrap"><table><thead><tr><th>BOOK</th><th>AUTHOR</th><th>CATEGORY</th><th>ISBN</th><th>AVAILABLE</th><th></th></tr></thead><tbody>{books.map(b => <tr key={b.Book_ID}><td><b>{b.Title}</b><small>ID #{b.Book_ID}</small></td><td>{b.Author || "—"}</td><td><span className="tag">{b.Category || "General"}</span></td><td>{b.ISBN || "—"}</td><td>{b.Available_Copies} / {b.Total_Copies}</td><td><button className="icon-button" title="Delete book" onClick={() => { if (confirm(`Delete "${b.Title}"?`)) action(`/books/${b.Book_ID}`, "DELETE"); }}>×</button></td></tr>)}</tbody></table>{books.length === 0 && <Empty text="No books found." />}</div></section>
          <section className="panel"><div className="panel-heading"><div><h3>Add a book</h3><p>Enter the book's details</p></div></div><form className="form-grid" onSubmit={e => submit(e, "books", "/books")}><Field label="Book title" required><input required value={forms.books.title} onChange={e => updateForm("books","title",e.target.value)} placeholder="Enter title"/></Field><Field label="Author"><select value={forms.books.author_id} onChange={e => updateForm("books","author_id",e.target.value)}><option value="">Select author</option>{authors.map(a => <option key={a.Author_ID} value={a.Author_ID}>{a.Author_Name}</option>)}</select></Field><Field label="Category"><input value={forms.books.category} onChange={e => updateForm("books","category",e.target.value)} placeholder="e.g. Fiction"/></Field><Field label="ISBN"><input value={forms.books.isbn} onChange={e => updateForm("books","isbn",e.target.value)} placeholder="ISBN number"/></Field><Field label="Total copies"><input type="number" min="1" required value={forms.books.total_copies} onChange={e => updateForm("books","total_copies",e.target.value)}/></Field><div className="form-actions"><button className="primary" disabled={busy}>＋ Add book</button></div></form></section></>}

        {page === "Authors" && <><section className="panel"><div className="panel-heading"><div><h3>Authors</h3><p>{authors.length} authors in the database</p></div></div><div className="author-grid">{authors.map(a => <div className="author-card" key={a.Author_ID}><div className="author-avatar">{a.Author_Name.split(" ").map(x=>x[0]).slice(0,2).join("").toUpperCase()}</div><div><b>{a.Author_Name}</b><small>Author ID #{a.Author_ID}</small></div></div>)}</div></section><section className="panel"><div className="panel-heading"><div><h3>Add author</h3><p>Add a new author to the catalog</p></div></div><form className="inline-form" onSubmit={e => submit(e,"authors","/authors")}><Field label="Author name" required><input required value={forms.authors.author_name} onChange={e => updateForm("authors","author_name",e.target.value)} placeholder="Full name"/></Field><button className="primary" disabled={busy}>＋ Add author</button></form></section></>}

        {page === "Users" && <><section className="panel"><div className="panel-heading"><div><h3>Library members</h3><p>Registered users and contact details</p></div><span className="count-pill">{users.length} members</span></div><div className="table-wrap"><table><thead><tr><th>MEMBER</th><th>EMAIL</th><th>PHONE</th><th>REGISTERED</th></tr></thead><tbody>{users.map(u => <tr key={u.User_ID}><td><b>{u.Name}</b><small>Member #{u.User_ID}</small></td><td>{u.Email}</td><td>{u.Phone || "—"}</td><td>{u.Created_At ? new Date(u.Created_At).toLocaleDateString() : "—"}</td></tr>)}</tbody></table></div></section><section className="panel"><div className="panel-heading"><div><h3>Register a member</h3><p>Create a library user record</p></div></div><form className="form-grid" onSubmit={e => submit(e,"users","/users")}><Field label="Full name" required><input required value={forms.users.name} onChange={e => updateForm("users","name",e.target.value)} placeholder="Member name"/></Field><Field label="Email address" required><input type="email" required value={forms.users.email} onChange={e => updateForm("users","email",e.target.value)} placeholder="member@example.com"/></Field><Field label="Phone"><input value={forms.users.phone} onChange={e => updateForm("users","phone",e.target.value)} placeholder="Phone number"/></Field><div className="form-actions"><button className="primary" disabled={busy}>＋ Register member</button></div></form></section></>}

        {page === "Borrowing" && <><section className="panel"><div className="panel-heading"><div><h3>Borrowing records</h3><p>Issue, track, and return books</p></div><span className="count-pill">{borrowing.filter(x=>!x.Return_Date).length} active</span></div><BorrowTable rows={borrowing} onReturn={id => action(`/borrowing/${id}/return`)} /></section><section className="panel"><div className="panel-heading"><div><h3>Issue a book</h3><p>Choose a member and an available book</p></div></div><form className="form-grid" onSubmit={e => submit(e,"borrowing","/borrowing")}><Field label="Member" required><select required value={forms.borrowing.user_id} onChange={e => updateForm("borrowing","user_id",e.target.value)}><option value="">Select member</option>{users.map(u=><option key={u.User_ID} value={u.User_ID}>{u.Name} (#{u.User_ID})</option>)}</select></Field><Field label="Available book" required><select required value={forms.borrowing.book_id} onChange={e => updateForm("borrowing","book_id",e.target.value)}><option value="">Select book</option>{books.filter(b=>b.Available_Copies>0).map(b=><option key={b.Book_ID} value={b.Book_ID}>{b.Title} ({b.Available_Copies} available)</option>)}</select></Field><Field label="Loan duration (days)" required><input type="number" min="1" max="90" value={forms.borrowing.loan_days} onChange={e=>updateForm("borrowing","loan_days",e.target.value)}/></Field><div className="form-actions"><button className="primary" disabled={busy}>⇄ Issue book</button></div></form></section></>}

        {page === "Fines" && <section className="panel"><div className="panel-heading"><div><h3>Fines & payments</h3><p>Late return fines are calculated at ₹5 per day</p></div><span className="count-pill">{fines.filter(f=>f.Payment_Status==="Pending").length} pending</span></div><div className="table-wrap"><table><thead><tr><th>FINE</th><th>MEMBER</th><th>AMOUNT</th><th>STATUS</th><th>CREATED</th><th></th></tr></thead><tbody>{fines.map(f=><tr key={f.Fine_ID}><td><b>Fine #{f.Fine_ID}</b><small>Borrow ID: {f.Borrow_ID ?? "—"}</small></td><td>{f.User_Name}</td><td><b>₹{Number(f.Amount).toFixed(2)}</b></td><td><span className={`status ${f.Payment_Status==="Paid"?"paid":"pending"}`}>{f.Payment_Status}</span></td><td>{f.Created_At ? new Date(f.Created_At).toLocaleDateString() : "—"}</td><td>{f.Payment_Status==="Pending" && <button className="small-button" onClick={()=>action(`/fines/${f.Fine_ID}/pay`)}>Mark paid</button>}</td></tr>)}</tbody></table>{fines.length===0 && <Empty text="No fines recorded."/>}</div></section>}
        <footer>Digital Library Management System <span>•</span> College project</footer>
      </main>
    </div>
  );
}

function Field({ label, required, children }) {
  return <label className="field"><span>{label}{required && <em> *</em>}</span>{children}</label>;
}
function Empty({ text }) { return <div className="empty">{text}</div>; }
function BorrowTable({ rows, onReturn, compact = false }) {
  return <div className="table-wrap"><table><thead><tr><th>MEMBER / BOOK</th><th>ISSUED</th><th>DUE DATE</th><th>STATUS</th><th></th></tr></thead><tbody>{rows.map(r=><tr key={r.Borrow_ID}><td><b>{r.User_Name}</b><small>{r.Title}</small></td><td>{formatDate(r.Issue_Date)}</td><td>{formatDate(r.Due_Date)}</td><td><span className={`status ${r.Return_Date?"returned":"pending"}`}>{r.Return_Date?"Returned":"Borrowed"}</span></td><td>{!r.Return_Date && <button className="small-button" onClick={()=>onReturn(r.Borrow_ID)}>Return</button>}</td></tr>)}</tbody>{rows.length===0 && <tbody><tr><td colSpan="5"><Empty text="No borrowing records yet."/></td></tr></tbody>}</table></div>;
}
function formatDate(value) {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? String(value).slice(0,10) : date.toLocaleDateString();
}
