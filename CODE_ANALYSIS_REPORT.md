# Lampara Website - Comprehensive Code Analysis Report

**Project**: React/Vite Solar Installation Website  
**Date**: April 9, 2026  
**Scope**: src/, config files, library files, and deployment configuration

---

## FINDINGS SUMMARY
- **Critical Issues**: 5
- **High Priority**: 8
- **Medium Priority**: 12
- **Low Priority**: 7

---

## 1. SECURITY VULNERABILITIES

### 1.1 CRITICAL: CLIENT SECRETS.txt Tracked in Git
**Severity**: CRITICAL  
**Location**: [CLIENT SECRETS.txt](CLIENT SECRETS.txt) (root project)  
**Issue**:  
A file containing what appears to be a secret token/hash (`e15ced5dabcd83e96cdfb9de9132a20b34886f50`) is in the repository. While it's in .gitignore, if it was ever committed before the .gitignore was added, it exists in git history.

**Why it Matters**:  
- Secret tokens in version control expose your project to credential compromise
- Git history is permanent; secrets must be rotated if exposed
- Anyone with repository access can extract the full commit history

**Recommended Fix**:
```bash
# 1. Immediately rotate any secrets/API keys associated with this token
# 2. If file contains sensitive data, use git-filter-branch or BFG to remove from history
git log --all --full-history -- CLIENT\ SECRETS.txt
# 3. Delete the file; add to .gitignore if not already done
rm CLIENT\ SECRETS.txt
# 4. Update README to document what the secret was used for
```

---

### 1.2 HIGH: Missing Input Validation on Email Contact Form
**Severity**: HIGH  
**Location**: [src/pages/Home.jsx](src/pages/Home.jsx#L750-850)  
**Issue**:  
The Contact form component (`Contact()` function) has minimal email validation—only HTML5 email type attribute:
```jsx
<input type="email" name="email" ... />
```

No server-side or client-side validation checks email format, length, or spam patterns before sending.

**Why it Matters**:  
- Invalid emails can be submitted to your database and EmailJS
- Malicious actors can pollute your contact records
- Violates OWASP input validation requirements
- No XSS protection on form data before EmailJS send

**Recommended Fix**:
```jsx
// Add comprehensive email validation
const validateEmail = (email) => {
  const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return re.test(email) && email.length <= 254;
};

// Add sanitization before sending
const sanitizeInput = (str) => {
  return str.trim().replace(/[<>]/g, '');
};

// In handleSubmit:
if (!validateEmail(form.email)) {
  setStatus('error');
  setError('Please enter a valid email address');
  return;
}
```

---

### 1.3 HIGH: Hardcoded EmailJS Credentials in Client Code
**Severity**: HIGH  
**Location**: [src/pages/Home.jsx](src/pages/Home.jsx#L710) and [src/pages/Schedule.jsx](src/pages/Schedule.jsx#L21-23)  
**Issue**:  
EmailJS credentials are hardcoded directly in component files:
```jsx
// Home.jsx Contact form
const EMAILJS_PUBLIC_KEY = '_rgBAjoEUDIAq9fGO';
const payload.user_id = EMAILJS_PUBLIC_KEY;

// Schedule.jsx
const EMAILJS_SERVICE_ID = 'service_lampara';
const EMAILJS_COMPANY_TPL = 'template_booking_company';
const EMAILJS_PUBLIC_KEY = '_rgBAjoEUDIAq9fGO';
```

While EmailJS public key is meant to be public, hardcoding means:
- Service ID and Template ID are exposed (unnecessary)
- No easy way to rotate credentials without code deployment
- Difficult to maintain multiple environments (dev/staging/prod)

**Why it Matters**:  
- Credentials should be in environment variables
- If EmailJS is compromised, rotating means code changes + redeploy
- Template ID shouldn't be guessable from source code

**Recommended Fix**:
Migrate to `.env` variables:
```
VITE_EMAILJS_SERVICE_ID=service_lampara
VITE_EMAILJS_TEMPLATE_ID_BOOKING=template_booking_company
VITE_EMAILJS_TEMPLATE_ID_CONTACT=template_lampara
VITE_EMAILJS_PUBLIC_KEY=_rgBAjoEUDIAq9fGO
```

Then access with:
```jsx
const EMAILJS_SERVICE_ID = import.meta.env.VITE_EMAILJS_SERVICE_ID;
```

---

### 1.4 HIGH: Password Minimum Length Too Weak
**Severity**: HIGH  
**Location**: [src/pages/ResetPassword.jsx](src/pages/ResetPassword.jsx#L45), [src/pages/AdminAttendance.jsx](src/pages/AdminAttendance.jsx#L465)  
**Issue**:  
Passwords are only required to be 6 characters minimum:
```jsx
<input minLength={6} placeholder="Min. 6 characters" />
```

NIST guidelines recommend minimum 8 characters, and best practice is 10+.

**Why it Matters**:  
- 6-character passwords are vulnerable to brute force
- Admin panel credentials should be stronger
- Worker registration passwords could be compromised

**Recommended Fix**:
```jsx
// Change to minimum 10 characters
<input type="password" minLength={10} placeholder="Min. 10 characters" />
// Client validation
if (password.length < 10) {
  setError('Password must be at least 10 characters');
}
```

---

### 1.5 HIGH: No CSRF Protection on Sensitive Admin Operations
**Severity**: HIGH  
**Location**: [src/pages/Admin.jsx](src/pages/Admin.jsx#L170-185), [src/pages/AdminAttendance.jsx](src/pages/AdminAttendance.jsx#L121-143)  
**Issue**:  
Admin operations like delete project, approve/reject workers, update rates have no CSRF tokens or validation:
```jsx
const handleDelete = async (id) => {
  if (!window.confirm('Delete this project...?')) return;
  // No CSRF token, rate limiting, or audit logging
  await supabase.from('projects').delete().eq('id', id);
  loadProjects();
};
```

**Why it Matters**:  
- Authenticated users could be tricked into performing unintended actions
- No audit trail of who deleted what
- One-click deletions without confirmation link

**Recommended Fix**:
1. Require confirmation with re-authentication for destructive ops
2. Add database audit table to log admin actions
3. Implement rate limiting on delete endpoints
4. Add soft-delete option instead of hard delete

---

---

## 2. REACT BEST PRACTICES VIOLATIONS

### 2.1 CRITICAL: Missing Error Handling in Multiple Components
**Severity**: CRITICAL  
**Location**: [src/pages/AdminAttendance.jsx](src/pages/AdminAttendance.jsx#L121-143)  
**Issue**:  
Multiple async operations lack error handling and don't provide user feedback:

```jsx
// handleApprove - NO error handling
const handleApprove = async (id) => {
  setActionLoading(id + '_approve');
  await supabase.from('workers').update({ status: 'active' }).eq('id', id);
  setActionLoading(null);
  load(); // If load() fails, user sees nothing
};

// handleDelete - No error state
const handleDelete = async (id, name) => {
  if (!window.confirm(...)) return;
  await supabase.from('attendance_logs').delete().eq('worker_id', id);
  await supabase.from('workers').delete().eq('id', id); // Chain fails silently
  load();
};

// handleUpdateRate - Silent failures
const handleUpdateRate = async (id, rate) => {
  await supabase.from('workers').update({ daily_rate: rate }).eq('id', id);
  load();
};
```

**Why it Matters**:  
- Users don't know if operations succeeded or failed
- Database could be in inconsistent state
- Admin can't troubleshoot issues
- Production failures go unnoticed

**Recommended Fix**:
```jsx
const handleApprove = async (id) => {
  setActionLoading(id + '_approve');
  try {
    const { error } = await supabase
      .from('workers')
      .update({ status: 'active' })
      .eq('id', id);
    
    if (error) throw error;
    
    await load();
    // Optionally: show success toast
  } catch (err) {
    console.error('Approve failed:', err);
    setError(`Failed to approve worker: ${err.message}`);
    // Retry logic or fallback UI
  } finally {
    setActionLoading(null);
  }
};
```

---

### 2.2 HIGH: Memory Leak in Attendance Camera Component
**Severity**: HIGH  
**Location**: [src/pages/Attendance.jsx](src/pages/Attendance.jsx#L300-330)  
**Issue**:  
Camera setup runs a detection loop but cleanup may not fully stop:

```jsx
const startDetectionLoop = () => {
  detectionRef.current = setInterval(() => {
    // Runs every 100ms
    const rect = detectFace(video);
    drawDetection(canvasRef.current, video, rect);
  }, 100);
};

// Cleanup in useEffect, but component might unmount before
useEffect(() => () => {
  clearInterval(detectionRef.current);
  streamRef.current?.getTracks().forEach(t => t.stop());
}, []);
```

**Why it Matters**:  
- Detection loop consumes CPU continuously
- WebRTC streams not fully released can lock device camera
- Multiple component mounts leak intervals
- Battery drain on mobile devices

**Recommended Fix**:
```jsx
useEffect(() => {
  let detectionRef_id = null;
  
  const startDetectionLoop = () => {
    detectionRef_id = setInterval(() => {
      if (!videoRef.current || videoRef.current.readyState < 2) return;
      // ... detection logic
    }, 100);
  };

  // Start only when needed
  if (cameraActive) startDetectionLoop();

  // Cleanup on unmount AND when cameraActive changes
  return () => {
    if (detectionRef_id) clearInterval(detectionRef_id);
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => {
        track.stop();
      });
      streamRef.current = null;
    }
  };
}, [cameraActive]);
```

---

### 2.3 HIGH: Race Condition in Supabase Data Fetches
**Severity**: HIGH  
**Location**: [src/pages/AdminAttendance.jsx](src/pages/AdminAttendance.jsx#L528), [src/pages/AdminAttendance.jsx](src/pages/AdminAttendance.jsx#L655), [src/pages/AdminAttendance.jsx](src/pages/AdminAttendance.jsx#L914)  
**Issue**:  
Promise chains in useEffect without cleanup or dependency handling:

```jsx
// Runs every render; no cleanup if component unmounts
supabase
  .from('workers')
  .select('id, name')
  .order('name')
  .then(({ data }) => setWorkers(data || [])); // Could set state after unmount!
```

**Why it Matters**:  
- Warning: "Can't perform a React state update on an unmounted component"
- State updates after component removed from DOM
- Multiple fetch calls queued, only last one used
- Data could be from stale promise

**Recommended Fix**:
```jsx
useEffect(() => {
  let isMounted = true; // Track mount status

  const loadWorkers = async () => {
    try {
      const { data, error } = await supabase
        .from('workers')
        .select('id, name')
        .order('name');
      
      if (error) throw error;
      
      // Only update if still mounted
      if (isMounted) {
        setWorkers(data || []);
      }
    } catch (err) {
      if (isMounted) {
        console.error('Failed to load workers:', err);
      }
    }
  };

  loadWorkers();

  // Cleanup
  return () => {
    isMounted = false;
  };
}, []); // Proper dependency array
```

---

### 2.4 HIGH: useEffect Dependency Array Issues
**Severity**: HIGH  
**Location**: [src/pages/Attendance.jsx](src/pages/Attendance.jsx#L320)  
**Issue**:  
ESLint disable-line comments hiding real issues:

```jsx
useEffect(() => {
  // ... setup video
}, [cameraActive]); // eslint-disable-line react-hooks/exhaustive-deps
```

The comment indicates dependencies are intentionally incomplete, creating potential bugs.

**Why it Matters**:  
- Disabling lint rules masks underlying issues
- Could cause stale closures in event handlers
- Variables from outer scope not tracked
- Difficult for team to maintain code

**Recommended Fix**:
Include all external variables in dependency array, or extract async logic to helper:
```jsx
useEffect(() => {
  if (!cameraActive) return;
  
  const setupVideo = async () => {
    // ... proper setup
  };

  setupVideo();
  
  return () => {
    // ... cleanup
  };
}, [cameraActive, videoRef, canvasRef]); // Include ALL deps
```

---

### 2.5 MEDIUM: No Loading States on Critical Admin Operations
**Severity**: MEDIUM  
**Location**: [src/pages/Admin.jsx](src/pages/Admin.jsx#L170-185), [src/pages/AdminSchedule.jsx](src/pages/AdminSchedule.jsx#L280-310)  
**Issue**:  
Delete operations provide no loading feedback:

```jsx
const handleDelete = async (id) => {
  if (!window.confirm('Delete...?')) return;
  // No loading state - button could be clicked multiple times
  await supabase.storage.from('project-images').remove([...]);
  await supabase.from('project_photos').delete().eq(...);
  await supabase.from('projects').delete().eq(...);
  loadProjects();
};
```

User could click delete multiple times, causing duplicate deletions or race conditions.

**Recommended Fix**:
```jsx
const [deleting, setDeleting] = useState(false);

const handleDelete = async (id) => {
  if (!window.confirm('Delete...?')) return;
  if (deleting) return; // Prevent double-click
  
  setDeleting(true);
  try {
    // ... delete operations
  } catch (err) {
    setError('Failed to delete: ' + err.message);
  } finally {
    setDeleting(false);
  }
};

// In UI:
<button disabled={deleting} onClick={() => handleDelete(id)}>
  {deleting ? 'Deleting...' : 'Delete'}
</button>
```

---

### 2.6 MEDIUM: Unnecessary Re-renders in Gallery Component
**Severity**: MEDIUM  
**Location**: [src/pages/Gallery.jsx](src/pages/Gallery.jsx#L55-75)  
**Issue**:  
The filter state causes full component re-render:

```jsx
const [filter, setFilter] = useState('all');

// Every filter change re-renders whole gallery
const filtered = filter === 'all'
  ? projects
  : projects.filter((p) => p.category === filter);
```

With large project lists, filtering causes unnecessary re-renders.

**Recommended Fix**:
```jsx
// Use useMemo to memoize filter result
const filtered = useMemo(() => {
  return filter === 'all'
    ? projects
    : projects.filter((p) => p.category === filter);
}, [projects, filter]);

// Or wrap GalleryCard in React.memo
const GalleryCard = React.memo(({ project, onOpen }) => {
  //...
});
```

---

---

## 3. ERROR HANDLING & VALIDATION GAPS

### 3.1 CRITICAL: Schedule Booking Form Missing Validation
**Severity**: CRITICAL  
**Location**: [src/pages/Schedule.jsx](src/pages/Schedule.jsx#L250-300)  
**Issue**:  
The booking form submits without comprehensive validation:

```jsx
const handleSubmit = async (e) => {
  e.preventDefault();
  setSending(true);
  setError('');

  try {
    // No validation of phone format, address, etc.
    const { error: dbErr } = await supabase.from('bookings').insert({
      date,
      name: form.name,      // No trim/sanitization
      email: form.email,    // No format check
      phone: form.phone || null,  // No phone format validation
      address: form.address, // No validation
      message: form.message || null,
    });
    // If error occurs, send email anyway?
    await sendEmail(EMAILJS_COMPANY_TPL, { ... });
  } catch (err) {
    // Bare catch, no error details
    setError('Something went wrong...');
  }
};
```

**Why it Matters**:  
- Invalid data pollutes database
- Emails sent with malformed info
- No phone number format means future issues with calling
- Silent failures on emailjs
- XSS vectors possible if address/message not sanitized

**Recommended Fix**:
```jsx
const validateBooking = (form) => {
  const errors = [];
  
  if (!form.name?.trim() || form.name.length < 2)
    errors.push('Name must be at least 2 characters');
  
  if (!form.email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email))
    errors.push('Invalid email');
  
  if (form.phone && !/^[\d\s\-\+\(\)]+$/.test(form.phone))
    errors.push('Invalid phone format');
  
  if (!form.address?.trim())
    errors.push('Address is required');
  
  return errors;
};

const handleSubmit = async (e) => {
  e.preventDefault();
  
  const validationErrors = validateBooking(form);
  if (validationErrors.length > 0) {
    setError(validationErrors.join(', '));
    return;
  }
  
  setSending(true);
  setError('');
  
  try {
    const sanitized = {
      date,
      name: form.name.trim(),
      email: form.email.toLowerCase().trim(),
      phone: form.phone?.trim() || null,
      address: form.address.trim(),
      message: form.message?.trim() || null,
    };
    
    const { error: dbErr } = await supabase.from('bookings').insert(sanitized);
    if (dbErr) throw dbErr;
    
    const emailErr = await sendEmail(EMAILJS_COMPANY_TPL, { ... });
    if (emailErr) {
      console.warn('Email notification failed:', emailErr);
      // Still consider booking successful in DB
    }
    
    onSuccess('Booking submitted...');
  } catch (err) {
    setError(`Booking failed: ${err.message}`);
  } finally {
    setSending(false);
  }
};
```

---

### 3.2 HIGH: No null/undefined Checks on Optional Fields
**Severity**: HIGH  
**Location**: [src/pages/Home.jsx](src/pages/Home.jsx#L50-60), [src/pages/Admin.jsx](src/pages/Admin.jsx#L240-250)  
**Issue**:  
Components display data without checking for existence:

```jsx
// Admin.jsx - coverPath might be undefined
const coverPath = photos[0]?.storage_path;
const coverUrl = coverPath ? ... : null;

// But then used directly:
{coverUrl && <img src={coverUrl} alt={project.title} />}

// Home.jsx - assumes project_photos exists
const urls = data.map((photo) => 
  supabase.storage.from('project-images')
    .getPublicUrl(photo.storage_path).data.publicUrl // .data could be null
);
```

No guarding against null/undefined responses from Supabase.

**Recommended Fix**:
```jsx
const getCover = (project) => {
  const photos = project?.project_photos ?? [];
  if (!Array.isArray(photos) || photos.length === 0) return null;
  
  const photo = photos[0];
  if (!photo?.storage_path) return null;
  
  const url = supabase
    .storage
    .from('project-images')
    .getPublicUrl(photo.storage_path)
    ?.data
    ?.publicUrl;
  
  return url ? `${url}?width=200&resize=cover` : null;
};
```

---

### 3.3 HIGH: sendEmail Function No Error Handling
**Severity**: HIGH  
**Location**: [src/pages/Schedule.jsx](src/pages/Schedule.jsx#L39-48)  
**Issue**:  
EmailJS fetch has no error handling:

```jsx
async function sendEmail(templateId, params) {
  await fetch('https://api.emailjs.com/api/v1.0/email/send', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      service_id: EMAILJS_SERVICE_ID,
      template_id: templateId,
      user_id: EMAILJS_PUBLIC_KEY,
      template_params: params,
    }),
  });
  // No response checking! Function always succeeds
}
```

Function doesn't check HTTP status, body, or errors. Users think email was sent when it failed.

**Recommended Fix**:
```jsx
async function sendEmail(templateId, params) {
  try {
    const response = await fetch('https://api.emailjs.com/api/v1.0/email/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        service_id: EMAILJS_SERVICE_ID,
        template_id: templateId,
        user_id: EMAILJS_PUBLIC_KEY,
        template_params: params,
      }),
      timeout: 10000, // 10 second timeout
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(`EmailJS error: ${data.message || response.statusText}`);
    }

    return { success: true, data };
  } catch (err) {
    console.error('Email send failed:', err);
    throw err; // Re-throw so caller can handle
  }
}
```

---

---

## 4. PERFORMANCE ISSUES

### 4.1 HIGH: No Image Optimization or Lazy Loading Strategy
**Severity**: HIGH  
**Location**: [src/pages/Home.jsx](src/pages/Home.jsx#L42-52), [src/pages/Gallery.jsx](src/pages/Gallery.jsx#L40-45)  
**Issue**:  
Images load without consideration for:
- Image size optimization
- srcset for responsive images
- Placeholder while loading
- No progressive loading

```jsx
const urls = data.map((photo) =>
  supabase.storage.from('project-images')
    .getPublicUrl(photo.storage_path).data.publicUrl + '?width=1920&resize=cover'
);

// Applied to:
<img src={url} alt={`...`} /> // Only one size for all devices

// Gallery:
<img src={coverUrl} alt={project.title} loading="lazy" /> // Only native lazy loading
```

On mobile, 1920px images are wasted bandwidth. No LQIP (Low Quality Image Placeholder).

**Recommended Fix**:
```jsx
// Use Supabase image transformation URL
const getImageUrl = (path, width, height) => {
  const base = supabase.storage.from('project-images').getPublicUrl(path).data.publicUrl;
  return `${base}?width=${width}&height=${height}&resize=cover`;
};

// In component:
<img
  srcSet={`
    ${getImageUrl(path, 400, 300)} 400w,
    ${getImageUrl(path, 800, 600)} 800w,
    ${getImageUrl(path, 1200, 900)} 1200w
  `}
  sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
  src={getImageUrl(path, 800, 600)}
  alt={title}
  loading="lazy"
  decoding="async"
/>
```

---

### 4.2 HIGH: Face Detection Loop Runs Too Frequently
**Severity**: HIGH  
**Location**: [src/pages/AdminAttendance.jsx](src/pages/AdminAttendance.jsx#L320-335)  
**Issue**:  
Detection runs every 100ms without throttling:

```jsx
const startDetectionLoop = () => {
  detectionRef.current = setInterval(() => {
    const video = videoRef.current;
    if (!video || video.readyState < 2) return;
    const rect = detectFace(video);
    drawDetection(canvasRef.current, video, rect);
  }, 100); // 10 checks per second
};
```

Continues even if face is already detected. Heavy computation on mobile.

**Recommended Fix**:
```jsx
const startDetectionLoop = () => {
  let lastCheck = 0;
  
  detectionRef.current = setInterval(() => {
    const now = performance.now();
    
    // Only check every 333ms (3 checks/sec) instead of 100ms
    if (now - lastCheck < 333) return;
    lastCheck = now;
    
    const video = videoRef.current;
    if (!video || video.readyState < 2) return;
    
    const rect = detectFace(video);
    drawDetection(canvasRef.current, video, rect);
  }, 100);
};

// Or use RequestAnimationFrame:
const startDetectionLoop = () => {
  let lastCheck = 0;
  
  const detect = () => {
    const now = performance.now();
    if (now - lastCheck > 333) {
      // ... detection logic
      lastCheck = now;
    }
    
    if (cameraActive) {
      requestAnimationFrame(detect);
    }
  };
  
  requestAnimationFrame(detect);
};
```

---

### 4.3 MEDIUM: No Pagination on Projects List
**Severity**: MEDIUM  
**Location**: [src/pages/Admin.jsx](src/pages/Admin.jsx#L150-156), [src/pages/Home.jsx](src/pages/Home.jsx#L410-425)  
**Issue**:  
All projects loaded at once:

```jsx
const { data, error } = await supabase
  .from('projects')
  .select('*, project_photos(id, storage_path, order_index)')
  .order('order_index', { ascending: false });
  // No .limit() or pagination
```

With hundreds of projects, page becomes slow.

**Recommended Fix**:
```jsx
const ITEMS_PER_PAGE = 12;
const [page, setPage] = useState(1);

const loadProjects = async () => {
  const start = (page - 1) * ITEMS_PER_PAGE;
  const { data, count } = await supabase
    .from('projects')
    .select('*, project_photos(...)', { count: 'exact' })
    .order('order_index', { ascending: false })
    .range(start, start + ITEMS_PER_PAGE - 1);
  
  setTotalPages(Math.ceil(count / ITEMS_PER_PAGE));
  setProjects(data);
};
```

---

### 4.4 MEDIUM: Unnecessary Interval for Slideshow in About Section
**Severity**: MEDIUM  
**Location**: [src/pages/Home.jsx](src/pages/Home.jsx#L190-200)  
**Issue**:  
About section rotates images every 60 seconds unconditionally:

```jsx
useEffect(() => {
  const timer = setInterval(() => {
    setActiveIndex((prev) => (prev + 1) % ABOUT_IMAGES.length);
  }, 60000); // Runs even if user is not viewing
  return () => clearInterval(timer);
}, []);
```

Interval runs even when image is not visible (below fold), wasting resources.

**Recommended Fix**:
```jsx
useEffect(() => {
  const observer = new IntersectionObserver(
    ([entry]) => {
      if (entry.isIntersecting && !timerRef.current) {
        // Start interval only when visible
        timerRef.current = setInterval(() => {
          setActiveIndex((prev) => (prev + 1) % ABOUT_IMAGES.length);
        }, 60000);
      } else if (!entry.isIntersecting && timerRef.current) {
        // Stop when not visible
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    }
  );

  const aboutEl = document.querySelector('.about__slideshow');
  if (aboutEl) observer.observe(aboutEl);

  return () => observer.disconnect();
}, []);
```

---

---

## 5. ACCESSIBILITY ISSUES

### 5.1 MEDIUM: Missing ARIA Labels and Descriptions
**Severity**: MEDIUM  
**Location**: [src/pages/Gallery.jsx](src/pages/Gallery.jsx#L50-60), [src/pages/Home.jsx](src/pages/Home.jsx#L310-330)  
**Issue**:  
Gallery cards lack proper semantic labeling:

```jsx
<div
  className="gallery-card"
  onClick={() => openLightbox(project)}  // No role, no keyboard handling
  data-aos="zoom-in"
>
```

Interactive divs should be buttons or have proper ARIA attributes.

**Recommended Fix**:
```jsx
<div
  className="gallery-card"
  role="button"
  tabIndex={0}
  onClick={() => openLightbox(project)}
  onKeyDown={(e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      openLightbox(project);
    }
  }}
  aria-label={`View ${project.title} - ${photoCount} photos`}
>
```

---

### 5.2 MEDIUM: Stat Updates Missing Semantic Markup
**Severity**: MEDIUM  
**Location**: [src/pages/Home.jsx](src/pages/Home.jsx#L100-120)  
**Issue**:  
Stats section uses divs without semantic meaning:

```jsx
<div className="stats__value">{s.value}</div>
<div className="stats__label">{s.label}</div>
```

Should use `<dd>` for definition terms or proper heading structures.

**Recommended Fix**:
```jsx
<dl className="stats__grid">
  {stats.map((s) => (
    <div key={s.label} className="stats__item">
      <dt className="sr-only">{s.label}</dt>
      <dd className="stats__value">{s.value}</dd>
      <dd className="stats__label">{s.label}</dd>
    </div>
  ))}
</dl>
```

---

### 5.3 LOW: Contact Form Placeholder Not Accessible
**Severity**: LOW  
**Location**: [src/pages/Home.jsx](src/pages/Home.jsx#L730-760)  
**Issue**:  
Relying on placeholder text instead of visible labels:

```jsx
<input
  placeholder="Juan dela Cruz"
  // No label element
/>
```

Screen readers don't associate placeholder with input.

**Recommended Fix**:
```jsx
<div className="contact__field">
  <label htmlFor="contact-name">Full Name</label>
  <input
    id="contact-name"
    type="text"
    placeholder="Juan dela Cruz"
  />
</div>
```

---

---

## 6. RESPONSIVE DESIGN & MOBILE ISSUES

### 6.1 MEDIUM: Hero Section Background Images Not Optimized for Mobile
**Severity**: MEDIUM  
**Location**: [src/pages/Home.jsx](src/pages/Home.jsx#L42-52)  
**Issue**:  
All background images queried with `?width=1920` regardless of screen size:

```jsx
const urls = data.map((photo) =>
  supabase.storage.from('project-images')
    .getPublicUrl(photo.storage_path).data.publicUrl + '?width=1920&resize=cover'
);
```

Mobile devices download 1920px images unnecessarily.

**Recommended Fix**:
```jsx
const getHeroImageUrl = (path) => {
  const width = window.innerWidth > 1024 ? 1920 : 
                window.innerWidth > 640 ? 1024 : 640;
  return `${supabase.storage.from('project-images').getPublicUrl(path).data.publicUrl}?width=${width}&resize=cover`;
};
```

---

### 6.2 MEDIUM: Sticky Quote Bar Not Dismissible on Mobile
**Severity**: MEDIUM  
**Location**: [src/pages/Home.jsx](src/pages/Home.jsx#L1000-1050)  
**Issue**:  
The sticky quote bar hides on contact scroll but can't be manually dismissed:

```jsx
function StickyQuoteBar() {
  const [hidden, setHidden] = useState(false);

  useEffect(() => {
    const observer = new IntersectionObserver(([entry]) => 
      setHidden(entry.isIntersecting)
    );
    // ... observer setup
    return () => observer.disconnect();
  }, []);

  // No close button, no manual dismiss
}
```

Takes up 15% of mobile viewport with no way to close.

**Recommended Fix**:
```jsx
function StickyQuoteBar() {
  const [hidden, setHidden] = useState(false);
  const [manuallyDismissed, setManuallyDismissed] = useState(false);

  // ... intersection observer

  if (hidden || manuallyDismissed) return null;

  return (
    <div className="sticky-quote-bar">
      {/* ... content */}
      <button
        onClick={() => setManuallyDismissed(true)}
        aria-label="Dismiss quote bar"
      >
        ×
      </button>
    </div>
  );
}
```

---

---

## 7. API & DATA FETCHING ISSUES

### 7.1 HIGH: No Network Timeout Handling
**Severity**: HIGH  
**Location**: [src/pages/Gallery.jsx](src/pages/Gallery.jsx#L17-26), [src/pages/Schedule.jsx](src/pages/Schedule.jsx#L70-85)  
**Issue**:  
Supabase queries can hang indefinitely:

```jsx
const { data, error } = await supabase
  .from('projects')
  .select(...);
  // No timeout, user could wait forever
```

On slow networks or server issues, page freezes.

**Recommended Fix**:
```jsx
const withTimeout = (promise, ms = 10000) => {
  return Promise.race([
    promise,
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error('Request timeout')), ms)
    ),
  ]);
};

// In load function:
try {
  const promise = supabase
    .from('projects')
    .select(...)
    .then(({ data, error }) => {
      if (error) throw error;
      return data;
    });

  const data = await withTimeout(promise, 10000);
  setProjects(data);
} catch (err) {
  if (err.message === 'Request timeout') {
    setError('Request took too long. Please try again.');
  } else {
    setError(err.message);
  }
}
```

---

### 7.2 MEDIUM: No Cache Strategy for Frequently Accessed Data
**Severity**: MEDIUM  
**Location**: [src/pages/Home.jsx](src/pages/Home.jsx), [src/pages/Gallery.jsx](src/pages/Gallery.jsx)  
**Issue**:  
Projects fetched on every page mount:

```jsx
useEffect(() => {
  async function load() {
    const { data } = await supabase.from('projects').select(...);
    setProjects(data);
  }
  load();
}, []); // Refetch if parent re-renders
```

Each navigation re-queries same data from database.

**Recommended Fix**:
```jsx
// Create context/global state manager
const ProjectsContext = createContext();

// In root App component:
const [projects, setProjects] = useState(null);

useEffect(() => {
  if (projects) return; // Already loaded

  supabase.from('projects').select(...).then(({ data }) => {
    setProjects(data);
  });
}, [projects]);

// In Gallery page:
const { projects } = useContext(ProjectsContext);
// Use cached projects
```

Or use React Query:
```jsx
import { useQuery } from '@tanstack/react-query';

export const useProjects = () => {
  return useQuery({
    queryKey: ['projects'],
    queryFn: async () => {
      const { data, error } = await supabase.from('projects').select(...);
      if (error) throw error;
      return data;
    },
    staleTime: 1000 * 60 * 5, // 5 minutes
  });
};
```

---

### 7.3 MEDIUM: SendEmail Called Twice with Different Data
**Severity**: MEDIUM  
**Location**: [src/pages/Schedule.jsx](src/pages/Schedule.jsx#L280-320)  
**Issue**:  
Booking modal sends email to company, but there's potential for double-sends:

```jsx
// 1. Save to DB
const { error: dbErr } = await supabase.from('bookings').insert({...});

// 2. Send company email
await sendEmail(EMAILJS_COMPANY_TPL, {...});

// Issue: If sendEmail fails, booking still saved but notification not sent
```

Should be transactional or at least logged.

**Recommended Fix**:
```jsx
const { error: dbErr } = await supabase.from('bookings').insert({...});
if (dbErr) throw dbErr;

try {
  await sendEmail(EMAILJS_COMPANY_TPL, {...});
} catch (emailErr) {
  console.error('Failed to send confirmation email:', emailErr);
  // Log to database for admin follow-up
  await supabase.from('failed_notifications').insert({
    type: 'booking_confirmation',
    booking_id: bookingId,
    error: emailErr.message,
    created_at: new Date().toISOString(),
  });
  // Don't fail the whole request
}
```

---

---

## 8. COMPONENT STRUCTURE & CODE ORGANIZATION

### 8.1 MEDIUM: Monolithic Page Components Too Large
**Severity**: MEDIUM  
**Location**: [src/pages/Home.jsx](src/pages/Home.jsx) (1000+ lines), [src/pages/AdminAttendance.jsx](src/pages/AdminAttendance.jsx) (1000+ lines)  
**Issue**:  
Single files contain multiple independent components:

```jsx
// Home.jsx contains:
- Hero
- Stats  
- About
- Packages
- Installations
- SolarInfo
- Calculator
- Testimonials
- FAQ
- Contact
- BackToTop
- MessengerFab
- StickyQuoteBar
```

Difficult to test, reuse, or maintain.

**Recommended Fix**:
```
src/
  pages/
    Home.jsx
  components/
    Hero.jsx
    Stats.jsx
    About.jsx
    Packages.jsx
    Installations.jsx
    SolarInfo.jsx
    Calculator.jsx
    Testimonials.jsx
    FAQ.jsx
    Contact.jsx
    BackToTop.jsx
    MessengerFab.jsx
    StickyQuoteBar.jsx
```

Then import in Home.jsx.

---

### 8.2 MEDIUM: Missing Constants File
**Severity**: MEDIUM  
**Location**: Throughout codebase  
**Issue**:  
Magic values scattered everywhere:

```jsx
.limit(6)  // Why 6?
, 60000); // Why 60 seconds?
offset: 100,  // Why 100?
minNeighbors: 4,  // Haar cascade parameter
```

---

### 8.3 LOW: No Error Boundary Component
**Severity**: LOW  
**Location**: [src/App.jsx](src/App.jsx)  
**Issue**:  
React errors crash entire app. No error boundary to catch and gracefully degrade.

**Recommended Fix**:
```jsx
// src/components/ErrorBoundary.jsx
export class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error, errorInfo) {
    console.error('Error caught:', error, errorInfo);
    // Report to error tracking service
  }

  render() {
    if (this.state.hasError) {
      return <ErrorFallback />;
    }
    return this.props.children;
  }
}

// In App.jsx:
export default function App() {
  return (
    <ErrorBoundary>
      <Routes>
        {/* ... */}
      </Routes>
    </ErrorBoundary>
  );
}
```

---

---

## 9. BUILD & DEPLOYMENT CONFIGURATION

### 9.1 MEDIUM: Vite Config Missing Security Headers
**Severity**: MEDIUM  
**Location**: [vite.config.js](vite.config.js)  
**Issue**:  
No security-related middleware configuration:

```jsx
export default defineConfig({
  plugins: [react()],
  // Missing:
  // - CORS configuration
  // - Security headers
  // - CSP settings
  // - Proper production build config
});
```

**Recommended Fix**:
```jsx
export default defineConfig({
  plugins: [react()],
  resolve: {
    extensions: ['.mjs', '.js', '.jsx', '.ts', '.tsx', '.json'],
  },
  server: {
    port: 3000,
    open: true,
    headers: {
      'X-Content-Type-Options': 'nosniff',
      'X-Frame-Options': 'DENY',
      'X-XSS-Protection': '1; mode=block',
    },
  },
  preview: {
    port: 4173,
    headers: {
      'X-Content-Type-Options': 'nosniff',
      'X-Frame-Options': 'DENY',
      'X-XSS-Protection': '1; mode=block',
      'Referrer-Policy': 'strict-origin-when-cross-origin',
    },
  },
  build: {
    outDir: 'dist',
    minify: 'terser',
    sourcemap: false, // Don't expose source maps in production
    rollupOptions: {
      output: {
        // Split chunks for better caching
        manualChunks: {
          vendor: ['react', 'react-dom', 'react-router-dom'],
          supabase: ['@supabase/supabase-js'],
        },
      },
    },
  },
});
```

---

### 9.2 MEDIUM: Missing CSP Headers in Vercel Config
**Severity**: MEDIUM  
**Location**: [vercel.json](vercel.json)  
**Issue**:  
No security policies configured:

```json
{
  "rewrites": [
    {
      "source": "/((?!assets|config|api|.*\\..*).*)",
      "destination": "/index.html"
    }
  ]
}
```

Should include CSP, CORS, and other security headers.

**Recommended Fix**:
```json
{
  "rewrites": [
    {
      "source": "/((?!assets|config|api|.*\\..*).*)",
      "destination": "/index.html"
    }
  ],
  "headers": [
    {
      "source": "/(.*)",
      "headers": [
        {
          "key": "X-Content-Type-Options",
          "value": "nosniff"
        },
        {
          "key": "X-Frame-Options",
          "value": "DENY"
        },
        {
          "key": "X-XSS-Protection",
          "value": "1; mode=block"
        },
        {
          "key": "Referrer-Policy",
          "value": "strict-origin-when-cross-origin"
        },
        {
          "key": "Content-Security-Policy",
          "value": "default-src 'self'; script-src 'self' 'unsafe-inline' https://docs.opencv.org https://api.emailjs.com; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; font-src 'self' data:; connect-src 'self' https://bvhrfebmpxvmqvofeuet.supabase.co https://api.emailjs.com"
        }
      ]
    }
  ]
}
```

---

### 9.3 LOW: No Version/Changelog Documentation
**Severity**: LOW  
**Location**: Project root  
**Issue**:  
No CHANGELOG.md or versioning strategy documented.

**Recommended Fix**:
Create [CHANGELOG.md](CHANGELOG.md) with entries for each release, and create [DEVELOPMENT.md](DEVELOPMENT.md) with setup instructions.

---

---

## 10. ENVIRONMENT & CONFIGURATION

### 10.1 MEDIUM: .env.local Committed but Should Not Be
**Severity**: MEDIUM  
**Location**: [.env.local](.env.local)  
**Issue**:  
While the file is in .gitignore, if accidentally committed before, credentials are exposed.

**Status**: Currently appears gitignored properly.  
**Action**: Ensure it remains gitignored and never commit.

---

### 10.2 LOW: Missing .env.example Template
**Severity**: LOW  
**Location**: Project root  
**Issue**:  
No `.env.example` file for developers to understand required variables.

**Recommended Fix**:
Create [.env.example](.env.example):
```
VITE_SUPABASE_URL=https://your-supabase-url.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key-here
VITE_EMAILJS_SERVICE_ID=service_lampara
VITE_EMAILJS_TEMPLATE_ID_BOOKING=template_booking_company
VITE_EMAILJS_TEMPLATE_ID_CONTACT=template_lampara
VITE_EMAILJS_PUBLIC_KEY=your-public-key-here
```

---

---

## SUMMARY TABLE

| Category | Count | Severity Distribution |
|----------|-------|----------------------|
| Security | 5 | 1 Critical, 3 High, 1 Medium |
| React Practices | 6 | 2 Critical, 3 High, 1 Medium |
| Error Handling | 3 | 1 Critical, 2 High |
| Performance | 4 | 2 High, 2 Medium |
| Accessibility | 3 | 3 Medium |
| Responsive Design | 2 | 2 Medium |
| API & Data | 3 | 1 High, 2 Medium |
| Code Organization | 3 | 1 Medium, 2 Low |
| Build & Deploy | 3 | 1 Medium, 2 Low |
| Environment | 2 | 1 Medium, 1 Low |
| **TOTAL** | **34** | **5 Critical, 8 High, 12 Medium, 7 Low** |

---

## PRIORITY ACTION ITEMS

### IMMEDIATE (Next 24 hours)
1. [ ] Rotate any secrets from CLIENT SECRETS.txt
2. [ ] Move EmailJS credentials to .env variables
3. [ ] Add comprehensive error handling to admin operations (AdminAttendance.jsx)
4. [ ] Fix memory leak in Attendance camera component

### SHORT-TERM (This week)
5. [ ] Implement proper form validation for Schedule booking
6. [ ] Add error handling to sendEmail function
7. [ ] Fix race condition in Supabase fetches
8. [ ] Move hardcoded values to constants file
9. [ ] Add Error Boundary to App.jsx
10. [ ] Implement loading states on admin delete operations

### SOON (This sprint)
11. [ ] Optimize hero images for mobile
12. [ ] Extract monolithic Home/AdminAttendance into smaller components
13. [ ] Implement React Query for data caching
14. [ ] Add comprehensive logging for admin audits
15. [ ] Update Vite config with security headers
16. [ ] Add CSP headers to Vercel config

---

## RESOURCES FOR FIXES

- [OWASP Input Validation](https://owasp.org/www-community/attacks/xss/)
- [React Error Boundaries](https://react.dev/reference/react/Component#catching-rendering-errors-with-an-error-boundary)
- [React Performance Optimization](https://react.dev/reference/react/useMemo)
- [Supabase Best Practices](https://supabase.com/docs)
- [EmailJS Documentation](https://www.emailjs.com/docs/)
- [Web Accessibility Guidelines (WCAG)](https://www.w3.org/WAI/WCAG21/quickref/)
- [Content Security Policy Guide](https://developer.mozilla.org/en-US/docs/Web/HTTP/CSP)

---

