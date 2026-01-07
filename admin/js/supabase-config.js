const SUPABASE_URL = 'https://bvhrfebmpxvmqvofeuet.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJ2aHJmZWJtcHh2bXF2b2ZldWV0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njc3NzQ1ODMsImV4cCI6MjA4MzM1MDU4M30.jr1oma-EwTf85UN16UZrOO-gdqxyHzu6pgvcT5QUtUQ';

// Initialize Supabase client
const supabase = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
