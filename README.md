# Al Haidariya Heavy Equipment Hiring System

A lightweight web-based system for managing equipment rentals, sales reports, fleet operations, and invoicing.

## Features

✅ **Hiring Cards** — Track equipment rental requests with customer, equipment, pricing, and supervisor details  
✅ **Sales Reports** — Convert hiring cards into daily invoices with automatic VAT calculation  
✅ **Fleet & Ops** — Manage equipment inventory and operator assignments  
✅ **Customers** — Maintain customer database with contact and tax info  
✅ **Invoices** — Auto-generated invoices with payment tracking (INV-YYYY-NNN format)  
✅ **Machine Types Catalog** — Equipment categorized by supervisor  
✅ **Work Log** — Track equipment hours and overtime per card  
✅ **Notifications** — In-app alerts for supervisors when new orders arrive  

## Quick Start

### Requirements
- GitHub Account
- Supabase Account (free tier works)
- Modern web browser (Chrome, Firefox, Safari, Edge)

### Setup (5 minutes)

1. **Fork the repository**
   ```bash
   https://github.com/Mohamed-Hiring/alhaidariya
   ```

2. **Create Supabase Project**
   - Go to supabase.com → New Project
   - Copy `Project URL` and API keys
   - Update these in `index.html`:
     ```javascript
     var SUPA_URL  = 'your_project_url';
     var SUPA_ANON = 'your_anon_key';
     var SUPA_SVC  = 'your_service_role_key';
     ```

3. **Create Database Tables** (SQL in Supabase)
   ```sql
   CREATE TABLE app_data (
     id BIGSERIAL PRIMARY KEY,
     key TEXT UNIQUE NOT NULL,
     value JSONB,
     updated_at TIMESTAMPTZ DEFAULT NOW()
   );
   CREATE TABLE user_profiles (
     id UUID PRIMARY KEY REFERENCES auth.users(id),
     full_name TEXT,
     role TEXT DEFAULT 'supervisor',
     supervisor_name TEXT
   );
   ALTER TABLE app_data ENABLE ROW LEVEL SECURITY;
   ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;
   ```

4. **Deploy to GitHub Pages**
   - Settings → Pages → Source: `main` branch
   - Your site goes live at: `https://yourusername.github.io/alhaidariya`

5. **Create Users in Supabase Auth**
   - Add email/password for each supervisor
   - Create profile entry in `user_profiles` table

## Usage

### Roles
- **Admin** — Full access to all features and user management
- **Supervisor** — Only sees their own fleet, operators, and cards

### Workflow

#### 1. Creating a Hiring Card
```
Master Cards → + New Card
├─ Select Customer (or type new)
├─ Select Equipment (or type new)
├─ Enter Rate/Hour (BHD)
├─ Set Shift Times (calculates Daily Hours)
├─ Assign Supervisor
└─ Save
```

#### 2. Recording Work (Sales Report)
```
Sales Report → Select Date
├─ System loads all active cards for that date
├─ Enter actual hours worked
├─ Enter overtime hours
├─ Confirm (creates invoice entry)
└─ PDF Export (for records)
```

#### 3. Managing Fleet
```
Fleet & Ops → Machines tab
├─ Add equipment (name, plate number, supervisor)
├─ Track which operator is using which equipment
└─ View assignment history per card
```

#### 4. Invoicing
```
Invoices
├─ Auto-numbered (INV-2026-001, etc.)
├─ Shows customer debt history
├─ Record payments
├─ Mark as Pending/Partial/Paid
└─ PDF Export with company letterhead
```

## Machine Type Classification

Machines are auto-assigned to supervisors based on type:

| Supervisor | Equipment Types |
|-----------|-----------------|
| **Al Aqib** | JCB, Excavator, Telehandler, Roller, Wheel Loader, Grader, Rock Breaker |
| **Mohamed Al Ajmi** | Crane, Forklift, Scissor Lift, Manlift, Counterweight, Lowbed, Flatbed |
| **Haroun** | Dump Truck, Recovery Vehicle |
| **Mohamed Saeed** | Generator, Vacuum Tanker, Water Tanker, Pump, Air Compressor |

(Auto-assigned on first login from master card data)

## Technical Details

### Architecture
- **Frontend**: Single HTML file with vanilla JavaScript (no frameworks)
- **Database**: Supabase (PostgreSQL + REST API)
- **Authentication**: Supabase Auth
- **Hosting**: GitHub Pages (static files)
- **File Size**: 161 KB (HTML) + 330 KB (seed data)

### Data Structure
```javascript
{
  "key": "cards",           // Hiring cards array
  "key": "customers",       // Customer directory
  "key": "machine_types",   // Equipment catalog with supervisors
  "key": "fleet",           // Equipment inventory + operators
  "key": "invoices",        // All invoices with payments
  "key": "notifications",   // Supervisor alerts
  "key": "saved_recs"       // Saved reports/exports
}
```

### Browser Compatibility
- ✅ Chrome 90+
- ✅ Firefox 88+
- ✅ Safari 14+
- ✅ Edge 90+

### Offline Mode
- App caches data locally
- Works offline (reads from cache)
- Syncs to Supabase when back online

## Key Features Explained

### Auto-Seeding
On first login, the system automatically creates:
- 177 customers from existing card data
- 98 machine types with supervisor assignments
- Data saved to Supabase; won't re-run

### Real-Time Sync
- Changes sync every 400ms
- Simultaneous users see updates automatically
- Real-time subscriptions to Supabase

### VAT Handling
- VAT Rate: 10% (configured for Bahrain)
- Invoices show: Subtotal + VAT Amount + Total with VAT
- Reports can be filtered by VAT status

### Work Log
Each card tracks:
- Confirmed hours per day
- Overtime hours per day
- Operator assigned
- Equipment used
- Confirmation notes

## Troubleshooting

### "Cannot load the app"
→ Check Supabase URL and API keys in `index.html`

### Sign In not working
→ Create user in Supabase Auth, then add profile entry in `user_profiles` table

### Data not saving
→ Check Supabase RLS policies are correct; ensure user is authenticated

### Missing machines/customers
→ Check `machine_types` and `customers` in Supabase `app_data` table

## Customization

### Change Company Details
Edit in `index.html`:
```javascript
var COMPANY = {
  name:    'Company Name',
  legal:   'Legal Entity Name',
  address: 'Physical Address',
  vat:     'VAT Number',
  disclaimer: 'Custom disclaimer text'
};
```

### Change Supervisors
Edit in `index.html`:
```javascript
var SUPERVISORS = ["Name1", "Name2", "Name3"];
```

### Change Machine Assignment Rules
Edit `seedFromCards()` function in `index.html` → modify `assignSup()` regex patterns

## Deployment Checklist

- [ ] Supabase project created with correct tables
- [ ] API keys added to `index.html`
- [ ] Users created in Supabase Auth
- [ ] User profiles created in `user_profiles` table
- [ ] GitHub repository configured for Pages
- [ ] Domain/URL configured (if using custom domain)
- [ ] First user logs in successfully
- [ ] Test card created and synced to Supabase
- [ ] PDF export tested
- [ ] Mobile responsiveness verified

## Roadmap

- [ ] Mobile app (React Native)
- [ ] Advanced reporting (pivot tables, graphs)
- [ ] SMS/Email notifications
- [ ] Payment gateway integration
- [ ] Equipment maintenance tracking
- [ ] Multi-language support
- [ ] Dark mode
- [ ] API for third-party integration

## Support

**Repository**: https://github.com/Mohamed-Hiring/alhaidariya  
**Issues**: GitHub Issues (for bugs and feature requests)  
**Documentation**: See `SYSTEM_GUIDE.md` and `IT_SETUP_GUIDE.md`

## License

© 2026 Al Haidariya Heavy Equipment Hiring. All rights reserved.

---

**Version**: 1.0.0  
**Last Updated**: April 2026  
**Status**: Production Ready ✅
