const XLSX = require('xlsx');
const path = require('path');

const questions = [
  ['ID', 'Category', 'Question', 'Vendor Response'],
  ['Q1', 'General', 'Please describe your company, including year founded, headquarters location, and number of employees.', ''],
  ['Q2', 'General', 'What compliance certifications does your organization currently hold (e.g., SOC 2, ISO 27001, HIPAA, FedRAMP)?', ''],
  ['Q3', 'Infrastructure', 'Where is your production infrastructure hosted? Please specify cloud provider, regions, and whether multi-region redundancy is in place.', ''],
  ['Q4', 'Infrastructure', 'How are your development, staging, and production environments separated?', ''],
  ['Q5', 'Encryption', 'Describe how data is encrypted at rest. What encryption algorithm and key length are used?', ''],
  ['Q6', 'Encryption', 'Describe how data is encrypted in transit. What minimum TLS version is enforced?', ''],
  ['Q7', 'Encryption', 'How are encryption keys managed? Is key rotation performed, and if so, how frequently?', ''],
  ['Q8', 'Access Control', 'Do you enforce multi-factor authentication (MFA) for all employees accessing production systems?', ''],
  ['Q9', 'Access Control', 'Describe your access review process. How frequently are access privileges reviewed?', ''],
  ['Q10', 'Access Control', 'How quickly is access revoked when an employee is terminated?', ''],
  ['Q11', 'Access Control', 'Do you support Single Sign-On (SSO) for customer authentication? If so, which protocols (SAML, OIDC)?', ''],
  ['Q12', 'Vulnerability Mgmt', 'Do you conduct regular penetration testing? If so, how often and by which firm?', ''],
  ['Q13', 'Vulnerability Mgmt', 'Describe your vulnerability scanning practices for both infrastructure and application layers.', ''],
  ['Q14', 'Vulnerability Mgmt', 'What are your SLAs for patching critical, high, and medium vulnerabilities?', ''],
  ['Q15', 'Incident Response', 'Do you have a documented incident response plan? How often is it reviewed and tested?', ''],
  ['Q16', 'Incident Response', 'What is your customer notification timeline in the event of a security breach affecting their data?', ''],
  ['Q17', 'Incident Response', 'Have there been any confirmed security breaches in the past 12 months?', ''],
  ['Q18', 'Business Continuity', 'What are your Recovery Point Objective (RPO) and Recovery Time Objective (RTO)?', ''],
  ['Q19', 'Business Continuity', 'Describe your backup strategy, including frequency, retention period, and recovery testing schedule.', ''],
  ['Q20', 'Data Privacy', 'Does the customer retain full ownership of their data? Describe your data retention and deletion policies.', ''],
  ['Q21', 'Data Privacy', 'Do you offer data residency options for customers requiring data to remain in a specific geographic region?', ''],
  ['Q22', 'Data Privacy', 'List your subprocessors and describe your process for notifying customers of subprocessor changes.', ''],
  ['Q23', 'Personnel', 'Are background checks performed on all employees? Describe the scope of these checks.', ''],
  ['Q24', 'Personnel', 'Describe your security awareness training program, including frequency and phishing simulation results.', ''],
  ['Q25', 'Network Security', 'Describe your network security controls, including firewalls, DDoS protection, and intrusion detection systems.', ''],
];

const ws = XLSX.utils.aoa_to_sheet(questions);

// Set column widths
ws['!cols'] = [
  { wch: 5 },   // ID
  { wch: 18 },  // Category
  { wch: 80 },  // Question
  { wch: 60 },  // Response
];

const wb = XLSX.utils.book_new();
XLSX.utils.book_append_sheet(wb, ws, 'Security Questionnaire');
const outputPath = path.join(__dirname, 'sample-questionnaire.xlsx');
XLSX.writeFile(wb, outputPath);
console.log('Created:', outputPath);
