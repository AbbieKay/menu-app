const express = require('express');
const fs = require('fs');
const path = require('path');
const ejs = require('ejs');

const app = express();
const PORT = process.env.PORT || 3000;
const DATA_FILE = path.join(__dirname, 'data.json');

// Middleware to parse form data
app.use(express.urlencoded({ extended: true }));

// --- Data Management ---
function readData() {
    if (!fs.existsSync(DATA_FILE)) {
        const initialData = { items: [], choices: [] };
        fs.writeFileSync(DATA_FILE, JSON.stringify(initialData, null, 2));
        return initialData;
    }
    return JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
}

function writeData(data) {
    fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
}

// --- HTML Templates (Using EJS syntax) ---
const BASE_STYLE = `
<!DOCTYPE html>
<html>
<head>
    <title>Menu App</title>
    <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.min.css" rel="stylesheet">
    <style> body { padding: 20px; } .nav-link { font-weight: bold; } </style>
</head>
<body>
<nav class="navbar navbar-expand-lg navbar-dark bg-dark mb-4">
  <div class="container-fluid">
    <a class="navbar-brand" href="/">Event Menu</a>
    <div class="navbar-nav">
      <a class="nav-link" href="/">Viewer</a>
      <a class="nav-link" href="/admin">Admin</a>
    </div>
  </div>
</nav>
<div class="container">
`;

const VIEWER_HTML = BASE_STYLE + `
    <h2 class="mb-4">Make Your Choice</h2>
    
    <div class="card mb-4">
        <div class="card-body">
            <form method="POST" action="/vote">
                <div class="mb-3">
                    <label class="form-label">Your Name:</label>
                    <input type="text" name="user_name" class="form-control" required>
                </div>
                
                <label class="form-label fw-bold">Select your meal/drink:</label>
                <% categories.forEach(cat => { %>
                    <h5 class="mt-3 text-primary"><%= cat %>s</h5>
                    <% items.filter(i => i.category === cat).forEach(item => { %>
                        <div class="form-check">
                            <input class="form-check-input" type="radio" name="item_id" value="<%= item.id %>" required>
                            <label class="form-check-label">
                                <%= item.name %> <span class="badge bg-secondary"><%= item.votes %> votes</span>
                            </label>
                        </div>
                    <% }); %>
                <% }); %>
                
                <button type="submit" class="btn btn-success mt-3">Submit Choice</button>
            </form>
        </div>
    </div>

    <h3>Current Standings</h3>
    <table class="table table-striped">
        <thead><tr><th>Category</th><th>Item</th><th>Total Votes</th></tr></thead>
        <tbody>
            <% items.forEach(item => { %>
            <tr>
                <td><%= item.category %></td>
                <td><%= item.name %></td>
                <td><strong><%= item.votes %></strong></td>
            </tr>
            <% }); %>
        </tbody>
    </table>
</div></body></html>
`;

const ADMIN_HTML = BASE_STYLE + `
    <h2 class="mb-4">Admin Dashboard</h2>

    <div class="row">
        <div class="col-md-5">
            <div class="card mb-4">
                <div class="card-header bg-primary text-white">Add Menu Item</div>
                <div class="card-body">
                    <form method="POST" action="/admin/add">
                        <div class="mb-3">
                            <label class="form-label">Category:</label>
                            <select name="category" class="form-select" required>
                                <option value="Food">Food</option>
                                <option value="Meat">Meat</option>
                                <option value="Juice">Juice</option>
                                <option value="Wine">Wine</option>
                            </select>
                        </div>
                        <div class="mb-3">
                            <label class="form-label">Item Name:</label>
                            <input type="text" name="name" class="form-control" required>
                        </div>
                        <button type="submit" class="btn btn-primary">Add to Menu</button>
                    </form>
                </div>
            </div>
            
            <div class="card">
                <div class="card-header bg-danger text-white">Current Menu</div>
                <ul class="list-group list-group-flush">
                    <% items.forEach(item => { %>
                        <li class="list-group-item d-flex justify-content-between">
                            <%= item.name %> <span class="badge bg-light text-dark"><%= item.category %></span>
                        </li>
                    <% }); %>
                </ul>
            </div>
        </div>

        <div class="col-md-7">
            <div class="card">
                <div class="card-header bg-success text-white">Who Chose What</div>
                <div class="card-body">
                    <table class="table table-sm">
                        <thead><tr><th>Time</th><th>Guest</th><th>Category</th><th>Choice</th></tr></thead>
                        <tbody>
                            <% choices.forEach(choice => { %>
                            <tr>
                                <td><%= choice.timestamp %></td>
                                <td><%= choice.user_name %></td>
                                <td><%= choice.category %></td>
                                <td><%= choice.item_name %></td>
                            </tr>
                            <% }); %>
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    </div>
</div></body></html>
`;

// --- Routes ---

// Viewer Side
app.get('/', (req, res) => {
    const data = readData();
    
    // Calculate votes for each item
    const itemsWithVotes = data.items.map(item => {
        const votes = data.choices.filter(c => c.item_id === item.id).length;
        return { ...item, votes };
    });

    const categories = ['Food', 'Meat', 'Juice', 'Wine'];
    const html = ejs.render(VIEWER_HTML, { items: itemsWithVotes, categories });
    res.send(html);
});

// Handle Vote Submission
app.post('/vote', (req, res) => {
    const { user_name, item_id } = req.body;
    const data = readData();
    
    data.choices.push({
        id: Date.now(),
        item_id: parseInt(item_id),
        user_name: user_name,
        timestamp: new Date().toLocaleString()
    });
    
    writeData(data);
    res.redirect('/');
});

// Admin Side
app.get('/admin', (req, res) => {
    const data = readData();
    
    // Map choices to include item details for the table
    const detailedChoices = data.choices.map(choice => {
        const item = data.items.find(i => i.id === choice.item_id);
        return {
            ...choice,
            item_name: item ? item.name : 'Unknown',
            category: item ? item.category : 'Unknown'
        };
    }).reverse(); // Show newest first

    const html = ejs.render(ADMIN_HTML, { items: data.items, choices: detailedChoices });
    res.send(html);
});

// Handle Adding Menu Item
app.post('/admin/add', (req, res) => {
    const { category, name } = req.body;
    const data = readData();
    
    data.items.push({
        id: Date.now(),
        category: category,
        name: name
    });
    
    writeData(data);
    res.redirect('/admin');
});

// Start Server
app.listen(PORT, () => {
    console.log(`Server is running! Open http://localhost:${PORT} in your browser.`);
});