<p align="center">
  <img src="https://raw.githubusercontent.com/andreasbm/readme/master/assets/lines/rainbow.png" alt="rainbow line" width="100%">
</p>

<p align="center">
  <h1 align="center">🚗 Before You Sign</h1>
  <p align="center">
    <strong>Automotive Intelligence & Vehicle History Verification Engine</strong>
    <br />
    A high-performance data aggregation platform engineered to provide instant, transparent vehicle history reports, mitigating buyer risk in the second-hand automotive market.
  </p>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Node.js-339933?style=for-the-badge&logo=nodedotjs&logoColor=white" alt="Node.js" />
  <img src="https://img.shields.io/badge/Express.js-000000?style=for-the-badge&logo=express&logoColor=white" alt="Express" />
  <img src="https://img.shields.io/badge/PostgreSQL-316192?style=for-the-badge&logo=postgresql&logoColor=white" alt="PostgreSQL" />
  <img src="https://img.shields.io/badge/REST_API-005571?style=for-the-badge&logo=openapi-initiative&logoColor=white" alt="API Integration" />
</p>

<p align="center">
  <img src="https://cdn.dribbble.com/users/1206584/screenshots/11264380/media/1eb1dc54bce43f1146cdbc8ebdd4226f.gif" alt="Animated Report Generation Demo" width="600" style="border-radius: 10px; box-shadow: 0 4px 8px rgba(0,0,0,0.1);">
</p>

<p align="center">
  <img src="https://raw.githubusercontent.com/andreasbm/readme/master/assets/lines/rainbow.png" alt="rainbow line" width="100%">
</p>

## 🚀 The Core Problem
Asymmetric information in the used vehicle market frequently leads to fraudulent sales and hidden financial liabilities. Buyers often lack access to consolidated data regarding accident history, police theft reports, and outstanding financial encumbrances, leading to high-risk transactions.

## 💡 The Solution
**Before You Sign** resolves this information gap by acting as a centralized data aggregator. The application interfaces with external automotive databases to compile fragmented data points into a single, comprehensive verification report. This ensures that buyers can validate a vehicle's legal and physical status instantly before executing a purchase agreement.

---

## 🛠️ Tech Stack & Architecture

<table>
  <tr>
    <td align="center" width="33%">
      <h3>Core Infrastructure</h3>
      <p><b>Node.js & Express</b></p>
      <p>Architected utilizing a scalable <code>views/</code>, <code>routes/</code>, <code>public/</code>, <code>database/</code> module structure to isolate business logic.</p>
    </td>
    <td align="center" width="33%">
      <h3>Data Layer</h3>
      <p><b>PostgreSQL</b></p>
      <p>Relational database utilized to securely store user search histories, generated report metadata, and transactional records.</p>
    </td>
    <td align="center" width="33%">
      <h3>Integrations</h3>
      <p><b>RESTful APIs</b></p>
      <p>Engineered to consume and normalize third-party VIN decoding and automotive history endpoints.</p>
    </td>
  </tr>
</table>

---

## 🌟 Top 3 Features

<details>
  <summary><b>1. Automated Data Aggregation</b> <i>(Click to expand)</i></summary>
  <br>
  Engineered a robust backend controller that concurrently queries multiple external automotive APIs using a single Vehicle Identification Number (VIN), drastically reducing report generation latency.
</details>

<details>
  <summary><b>2. Standardized Reporting Pipeline</b> <i>(Click to expand)</i></summary>
  <br>
  Architected a data-normalization utility that ingests disparate JSON schemas from various third-party providers and sanitizes the data into a unified, strongly-typed internal format for clean UI rendering.
</details>

<details>
  <summary><b>3. Secure Search History & Caching</b> <i>(Click to expand)</i></summary>
  <br>
  Optimized API usage by implementing a database caching layer. If a specific VIN was recently verified, the system retrieves the cached report from the relational database, reducing external API costs and accelerating response times.
</details>

---

## 🧠 'The Why' (Architectural Decisions)

> **Why a modular MVC-style folder structure?**
> The project utilizes a strict `views/routes/public/database` structure. This separation of concerns was critical for this specific application because external API logic (fetching vehicle data) needed to be entirely decoupled from the presentation layer. This ensures the routing logic remains testable and scalable as more data providers are integrated in the future.

> **Why prioritize backend data normalization?**
> External data providers often return messy, incomplete, or inconsistently formatted data. Instead of forcing the frontend to handle conditional rendering logic, the backend was engineered to map all incoming data to a strict internal schema. This guarantees the frontend always receives clean, predictable payloads.

---

## 🚧 Challenges Overcome: API Rate Limiting & Timeout Mitigation

**The Technical Challenge:** Querying multiple external vehicle databases simultaneously introduced high latency. If one third-party service experienced downtime or rate-limited the request, the entire report generation process would hang, resulting in a poor user experience.

**The Engineering Solution:** This was resolved by engineering a `Promise.allSettled()` wrapper around the external fetch requests alongside strict timeout configurations. This fault-tolerant design ensures that if a non-critical data provider fails, the system gracefully degrades—logging the error internally while still returning the successful portions of the vehicle history report to the user without crashing the application.

---

## 📥 Setup & Installation

### 1. Environment Configuration
Create a `.env` file in the root directory and populate the required API keys:
```env
PORT=8000
DATABASE_URL=your-database-connection-string
VEHICLE_API_KEY=your-third-party-api-key
