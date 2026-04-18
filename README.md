ไฟล์ที่พัฒนามา (outputs)
----------
รายการรายละเอียดBackendlocalStorage + fetch() + google.script.run (GAS mode)Rolesadmin, province, coop (เหมือนกัน)Fields 
กรรมการเพิ่ม origTermLabel, dateInFirst, returnSelf, eligibleDateLogic วาระครบทุกกรณีพิเศษตาม พ.ร.บ.สหกรณ์ 
Fields พิเศษ✓ ครบฟังก์ชันพิเศษ✓ calcAccYears, termCodeSub, eligibleStatus, toggleSubFields, fmtYrs

สรุปสั้นๆ — ไฟล์ที่อัปโหลดคือ UI พื้นฐาน ไฟล์ที่พัฒนามาคือเวอร์ชันเดียวกันที่เพิ่มเงื่อนไขวาระครบตาม พ.ร.บ.สหกรณ์ 
และรองรับ GAS mode เพิ่มครับ
-----------
ได้เลยครับ — อัปขึ้น Netlify แทนไฟล์เดิมได้ทันที เพราะ:
netlify.toml ไม่ต้องแก้ไข ใช้ของเดิมได้เลย
index.html ไฟล์เดียว ไม่มี dependencies อื่น
URL เดิมยังใช้ได้ ไม่เปลี่ยน

วิธีอัปขึ้น Netlify:
-----------
วิธีที่ 1 — Drag & Drop (ง่ายที่สุด)
เปิด netlify.com
ไปที่ Site ที่ deploy ไว้
คลิก Deploys
ลาก index.html ใหม่ไปวางในช่อง Drag and drop

วิธีที่ 2 — ผ่าน GitHub
-----------
Push index.html ใหม่ขึ้น GitHub
Netlify จะ auto deploy ให้อัตโนมัติ

หลังอัปขึ้นแล้ว อย่าลืมตั้งค่าใน Settings:
เปิด Web App → เมนู Settings → กรอก:

Sheets URL = https://script.google.com/macros/s/XXXX/exec
Token = ค่าเดิมที่ตั้งไว้ใน Code.gs

แล้วกด ซิงค์ ครับ
--------------
