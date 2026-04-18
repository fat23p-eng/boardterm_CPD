// ============================================================
//  ระบบตรวจสอบวาระกรรมการสหกรณ์ — Google Apps Script Backend
//  รองรับทั้ง google.script.run (GAS) และ fetch() API (GitHub Pages)
//  Sheet ID: 1XRIeWAKW80KPgUKTeG3-2lO5Wdx5cA48HQ0g_i-CXqc
// ============================================================

const SHEET_ID = '1XRIeWAKW80KPgUKTeG3-2lO5Wdx5cA48HQ0g_i-CXqc';
const SESSION_EXPIRY_HOURS = 8;

const SHEETS = {
  BOARDS:   'BoardMembers',
  COOPS:    'Cooperatives',
  USERS:    'Users',
  AUDIT:    'AuditLog',
  SESSIONS: 'Sessions',
};

// ============================================================
//  doGet — เสิร์ฟ HTML (ใช้งานผ่าน GAS URL โดยตรง)
// ============================================================
function doGet(e) {
  return HtmlService
    .createTemplateFromFile('index')
    .evaluate()
    .setTitle('ระบบตรวจสอบวาระกรรมการสหกรณ์')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL)
    .addMetaTag('viewport', 'width=device-width, initial-scale=1');
}

// ============================================================
//  doPost — JSON API สำหรับ fetch() จาก GitHub Pages
//  Body: { "action": "login", "args": ["admin","1234"] }
// ============================================================
function doPost(e) {
  try {
    var body   = JSON.parse(e.postData.contents);
    var action = body.action;
    var args   = body.args || [];

    var DISPATCH = {
      'login':        function(a){ return login(a[0], a[1]); },
      'logout':       function(a){ return logout(a[0]); },
      'getCoops':     function(a){ return getCoops(a[0]); },
      'addCoop':      function(a){ return addCoop(a[0], a[1]); },
      'getBoards':    function(a){ return getBoards(a[0]); },
      'addBoard':     function(a){ return addBoard(a[0], a[1]); },
      'updateBoard':  function(a){ return updateBoard(a[0], a[1]); },
      'deleteBoard':  function(a){ return deleteBoard(a[0], a[1]); },
      'importBoards': function(a){ return importBoards(a[0], a[1]); },
      'exportBoards': function(a){ return exportBoards(a[0], a[1]); },
      'getUsers':     function(a){ return getUsers(a[0]); },
      'addUser':      function(a){ return addUser(a[0], a[1]); },
      'updateUser':   function(a){ return updateUser(a[0], a[1]); },
      'getAuditLog':  function(a){ return getAuditLog(a[0], a[1]); },
    };

    if (!DISPATCH[action]) {
      return jsonOut({ ok: false, error: 'Unknown action: ' + action });
    }
    return jsonOut(DISPATCH[action](args));

  } catch (err) {
    return jsonOut({ ok: false, error: err.message });
  }
}

function jsonOut(data) {
  return ContentService
    .createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}

// ============================================================
//  AUTH
// ============================================================
function login(username, password) {
  try {
    var ss    = SpreadsheetApp.openById(SHEET_ID);
    var sheet = ss.getSheetByName(SHEETS.USERS);
    if (!sheet) return { ok: false, error: 'ไม่พบ sheet Users' };
    var data = sheet.getDataRange().getValues();
    // header: ID, username, password, name, role, coopId, active
    for (var i = 1; i < data.length; i++) {
      var row = data[i];
      if (!row[0]) continue;
      if (String(row[1]).trim() === String(username).trim() &&
          String(row[2]).trim() === String(password).trim() &&
          String(row[7]).trim().toUpperCase() === 'TRUE') {
        var token = Utilities.getUuid();
        saveSession(token, String(row[0]), String(row[4]), String(row[5] || ''));
        return {
          ok: true,
          token: token,
          user: {
            id:     String(row[0]),
            name:   String(row[3]),
            role:   String(row[4]),
            coopId: String(row[5] || '')
          }
        };
      }
    }
    return { ok: false, error: 'ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง' };
  } catch (err) {
    return { ok: false, error: err.message };
  }
}

function logout(token) {
  deleteSession(token);
  return { ok: true };
}

function saveSession(token, userId, role, coopId) {
  var ss     = SpreadsheetApp.openById(SHEET_ID);
  var sheet  = ss.getSheetByName(SHEETS.SESSIONS);
  var expiry = new Date(Date.now() + SESSION_EXPIRY_HOURS * 3600000);
  sheet.appendRow([token, userId, role, coopId, expiry.toISOString()]);
}

function getSession(token) {
  if (!token) return null;
  var ss    = SpreadsheetApp.openById(SHEET_ID);
  var sheet = ss.getSheetByName(SHEETS.SESSIONS);
  var data  = sheet.getDataRange().getValues();
  var now   = new Date();
  for (var i = 1; i < data.length; i++) {
    if (String(data[i][0]) === String(token)) {
      if (new Date(data[i][4]) > now) {
        return {
          userId: String(data[i][1]),
          role:   String(data[i][2]),
          coopId: String(data[i][3] || '')
        };
      }
      sheet.deleteRow(i + 1);
      return null;
    }
  }
  return null;
}

function deleteSession(token) {
  var ss    = SpreadsheetApp.openById(SHEET_ID);
  var sheet = ss.getSheetByName(SHEETS.SESSIONS);
  var data  = sheet.getDataRange().getValues();
  for (var i = 1; i < data.length; i++) {
    if (String(data[i][0]) === String(token)) {
      sheet.deleteRow(i + 1);
      return;
    }
  }
}

// ============================================================
//  COOPERATIVES
// ============================================================
function getCoops(token) {
  var sess = getSession(token);
  if (!sess) return { ok: false, error: 'session หมดอายุ กรุณาเข้าสู่ระบบใหม่' };
  var ss    = SpreadsheetApp.openById(SHEET_ID);
  var sheet = ss.getSheetByName(SHEETS.COOPS);
  var data  = sheet.getDataRange().getValues();
  var coops = [];
  for (var i = 1; i < data.length; i++) {
    if (!data[i][0]) continue;
    if (String(data[i][3]).trim().toUpperCase() === 'FALSE') continue;
    if (sess.role !== 'admin' && String(data[i][0]) !== sess.coopId) continue;
    coops.push({
      id:   String(data[i][0]),
      name: String(data[i][1]),
      type: String(data[i][2])
    });
  }
  return { ok: true, data: coops };
}

function addCoop(token, coop) {
  var sess = getSession(token);
  if (!sess || sess.role !== 'admin') return { ok: false, error: 'ไม่มีสิทธิ์' };
  var ss    = SpreadsheetApp.openById(SHEET_ID);
  var sheet = ss.getSheetByName(SHEETS.COOPS);
  sheet.appendRow([coop.id, coop.name, coop.type, 'TRUE']);
  writeAudit(sess.userId, 'เพิ่มสหกรณ์', coop.name + ' (' + coop.id + ')');
  return { ok: true };
}

// ============================================================
//  BOARD MEMBERS
// ============================================================
// ============================================================
//  คำนวณ status อัตโนมัติ (ไม่ต้องเก็บใน Sheet)
//  เหมือนกับ Virtual Column ใน AppSheet
// ============================================================
function calcStatus(dateIn, dateOut, dateInFirst, returnSelf) {
  if (!dateIn) return 'active';
  if (dateOut) return 'resigned';
  // คำนวณปีสะสม
  var start = (returnSelf === 'TRUE' || dateInFirst) ? (dateInFirst || dateIn) : dateIn;
  var d1 = new Date(start);
  var d2 = new Date();
  var yrs = (d2 - d1) / (1000 * 60 * 60 * 24 * 365.25);
  if (yrs >= 4) return 'break';
  return 'active';
}

function getBoards(token) {
  var sess = getSession(token);
  if (!sess) return { ok: false, error: 'session หมดอายุ' };
  var ss    = SpreadsheetApp.openById(SHEET_ID);
  var sheet = ss.getSheetByName(SHEETS.BOARDS);
  var data  = sheet.getDataRange().getValues();
  var boards = [];
  for (var i = 1; i < data.length; i++) {
    var row = data[i];
    if (!row[0]) continue;
    if (sess.role !== 'admin' && String(row[1]) !== sess.coopId) continue;
    var _dateIn       = formatDate(row[3]);
    var _dateOut      = formatDate(row[4]);
    var _dateInFirst  = formatDate(row[9]);
    var _returnSelf   = String(row[10] || '');
    var _eligibleDate = formatDate(row[11]);
    boards.push({
      id:            String(row[0]),
      coopId:        String(row[1]),
      name:          String(row[2]),
      dateIn:        _dateIn,
      dateOut:       _dateOut,
      status:        calcStatus(_dateIn, _dateOut, _dateInFirst, _returnSelf),
      type:          String(row[5] || 'normal'),
      origDate:      formatDate(row[6]),
      note:          String(row[7] || ''),
      origTermLabel: String(row[8]  || ''),
      dateInFirst:   _dateInFirst,
      returnSelf:    _returnSelf,
      eligibleDate:  _eligibleDate,
    });
  }
  return { ok: true, data: boards };
}

function addBoard(token, board) {
  var sess = getSession(token);
  if (!sess) return { ok: false, error: 'session หมดอายุ' };
  if (sess.role === 'officer' && String(board.coopId) !== sess.coopId)
    return { ok: false, error: 'ไม่มีสิทธิ์เพิ่มกรรมการของสหกรณ์อื่น' };
  var ss    = SpreadsheetApp.openById(SHEET_ID);
  var sheet = ss.getSheetByName(SHEETS.BOARDS);
  var id    = 'BM' + Date.now();
  sheet.appendRow([
    id, board.coopId, board.name, board.dateIn, board.dateOut || '',
    board.type || 'normal',
    board.origDate || '', board.note || '',
    board.origTermLabel || '', board.dateInFirst || '', board.returnSelf || '',
    board.eligibleDate || ''
  ]);
  writeAudit(sess.userId, 'เพิ่มกรรมการ', board.name + ' (' + board.coopId + ')');
  return { ok: true, id: id };
}

function updateBoard(token, board) {
  var sess = getSession(token);
  if (!sess) return { ok: false, error: 'session หมดอายุ' };
  var ss    = SpreadsheetApp.openById(SHEET_ID);
  var sheet = ss.getSheetByName(SHEETS.BOARDS);
  var data  = sheet.getDataRange().getValues();
  for (var i = 1; i < data.length; i++) {
    if (String(data[i][0]) === String(board.id)) {
      if (sess.role === 'officer' && String(data[i][1]) !== sess.coopId)
        return { ok: false, error: 'ไม่มีสิทธิ์แก้ไขของสหกรณ์อื่น' };
      sheet.getRange(i + 1, 1, 1, 12).setValues([[
        board.id, board.coopId, board.name, board.dateIn, board.dateOut || '',
        board.type, board.origDate || '', board.note || '',
        board.origTermLabel || '', board.dateInFirst || '', board.returnSelf || '',
        board.eligibleDate || ''
      ]]);
      writeAudit(sess.userId, 'แก้ไขข้อมูล', board.name + ' (' + board.coopId + ')');
      return { ok: true };
    }
  }
  return { ok: false, error: 'ไม่พบข้อมูล' };
}

function deleteBoard(token, boardId) {
  var sess = getSession(token);
  if (!sess) return { ok: false, error: 'session หมดอายุ' };
  var ss    = SpreadsheetApp.openById(SHEET_ID);
  var sheet = ss.getSheetByName(SHEETS.BOARDS);
  var data  = sheet.getDataRange().getValues();
  for (var i = 1; i < data.length; i++) {
    if (String(data[i][0]) === String(boardId)) {
      if (sess.role === 'officer' && String(data[i][1]) !== sess.coopId)
        return { ok: false, error: 'ไม่มีสิทธิ์' };
      var name = String(data[i][2]), coopId = String(data[i][1]);
      sheet.deleteRow(i + 1);
      writeAudit(sess.userId, 'ลบกรรมการ', name + ' (' + coopId + ')');
      return { ok: true };
    }
  }
  return { ok: false, error: 'ไม่พบข้อมูล' };
}

function importBoards(token, rows) {
  var sess = getSession(token);
  if (!sess) return { ok: false, error: 'session หมดอายุ' };
  var ss    = SpreadsheetApp.openById(SHEET_ID);
  var sheet = ss.getSheetByName(SHEETS.BOARDS);
  var added = 0, errors = [];
  for (var i = 0; i < rows.length; i++) {
    var r = rows[i];
    if (sess.role === 'officer' && String(r.coopId) !== sess.coopId) {
      errors.push('แถว ' + (i + 1) + ': ไม่มีสิทธิ์'); continue;
    }
    sheet.appendRow([
      'BM' + Date.now() + '_' + i,
      r.coopId, r.name, r.dateIn, r.dateOut || '',
      r.type || 'normal',
      r.origDate || '', r.note || '',
      r.origTermLabel || '', r.dateInFirst || '', r.returnSelf || '',
      r.eligibleDate || ''
    ]);
    added++;
  }
  writeAudit(sess.userId, 'Import', added + ' รายการ');
  return { ok: true, added: added, errors: errors };
}

function exportBoards(token, coopId) {
  var sess = getSession(token);
  if (!sess) return { ok: false, error: 'session หมดอายุ' };
  var result = getBoards(token);
  if (!result.ok) return result;
  var data = result.data;
  if (coopId) data = data.filter(function(b) { return b.coopId === coopId; });
  writeAudit(sess.userId, 'Export', data.length + ' รายการ' + (coopId ? ' (' + coopId + ')' : ''));
  return { ok: true, data: data };
}

// ============================================================
//  USERS
// ============================================================
function getUsers(token) {
  var sess = getSession(token);
  if (!sess || sess.role !== 'admin') return { ok: false, error: 'ไม่มีสิทธิ์' };
  var ss    = SpreadsheetApp.openById(SHEET_ID);
  var sheet = ss.getSheetByName(SHEETS.USERS);
  var data  = sheet.getDataRange().getValues();
  var users = [];
  for (var i = 1; i < data.length; i++) {
    if (!data[i][0]) continue;
    users.push({
      id:       String(data[i][0]),
      username: String(data[i][1]),
      name:     String(data[i][3]),
      role:     String(data[i][4]),
      coopId:   String(data[i][5] || ''),
      active:   String(data[i][7]).trim().toUpperCase() === 'TRUE'
    });
  }
  return { ok: true, data: users };
}

function addUser(token, user) {
  var sess = getSession(token);
  if (!sess || sess.role !== 'admin') return { ok: false, error: 'ไม่มีสิทธิ์' };
  var ss    = SpreadsheetApp.openById(SHEET_ID);
  var sheet = ss.getSheetByName(SHEETS.USERS);
  var id    = 'U' + Date.now();
  sheet.appendRow([id, user.username, user.password, user.name,
    user.role, user.coopId || '', 'TRUE']);
  writeAudit(sess.userId, 'เพิ่มผู้ใช้', user.name + ' (' + user.username + ')');
  return { ok: true };
}

function updateUser(token, user) {
  var sess = getSession(token);
  if (!sess || sess.role !== 'admin') return { ok: false, error: 'ไม่มีสิทธิ์' };
  var ss    = SpreadsheetApp.openById(SHEET_ID);
  var sheet = ss.getSheetByName(SHEETS.USERS);
  var data  = sheet.getDataRange().getValues();
  for (var i = 1; i < data.length; i++) {
    if (String(data[i][0]) === String(user.id)) {
      var pwd = user.password || String(data[i][2]);
      sheet.getRange(i + 1, 1, 1, 8).setValues([[
        user.id, user.username, pwd, user.name,
        user.role, user.coopId || '', user.email || '',
        user.active ? 'TRUE' : 'FALSE'
      ]]);
      writeAudit(sess.userId, 'แก้ไขผู้ใช้', user.name);
      return { ok: true };
    }
  }
  return { ok: false, error: 'ไม่พบผู้ใช้' };
}

// ============================================================
//  AUDIT LOG
// ============================================================
function writeAudit(userId, action, detail) {
  var ss    = SpreadsheetApp.openById(SHEET_ID);
  var sheet = ss.getSheetByName(SHEETS.AUDIT);
  var now   = Utilities.formatDate(new Date(), 'Asia/Bangkok', 'yyyy-MM-dd HH:mm:ss');
  sheet.appendRow([now, userId, action, detail]);
}

function getAuditLog(token, limit) {
  var sess = getSession(token);
  if (!sess) return { ok: false, error: 'session หมดอายุ' };
  var ss    = SpreadsheetApp.openById(SHEET_ID);
  var sheet = ss.getSheetByName(SHEETS.AUDIT);
  var data  = sheet.getDataRange().getValues();
  var logs  = [];
  var max   = limit || 100;
  for (var i = data.length - 1; i >= 1 && logs.length < max; i--) {
    logs.push({
      ts:     String(data[i][0]),
      userId: String(data[i][1]),
      action: String(data[i][2]),
      detail: String(data[i][3])
    });
  }
  return { ok: true, data: logs };
}

// ============================================================
//  SETUP — รันครั้งเดียวเพื่อสร้าง Sheet structure
// ============================================================
function setupSheets() {
  var ss = SpreadsheetApp.openById(SHEET_ID);

  function ensureSheet(name, headers) {
    var sheet = ss.getSheetByName(name);
    if (!sheet) sheet = ss.insertSheet(name);
    if (sheet.getLastRow() === 0) {
      sheet.appendRow(headers);
      sheet.getRange(1, 1, 1, headers.length)
        .setBackground('#4A86E8')
        .setFontColor('#FFFFFF')
        .setFontWeight('bold');
    }
    return sheet;
  }

  ensureSheet(SHEETS.COOPS,    ['ID','name','type','active']);
  ensureSheet(SHEETS.BOARDS,   ['ID','coopId','name','dateIn','dateOut','type','origDate','note','origTermLabel','dateInFirst','returnSelf','eligibleDate']);
  ensureSheet(SHEETS.USERS,    ['ID','username','password','name','role','coopId','active']);
  ensureSheet(SHEETS.AUDIT,    ['timestamp','userId','action','detail']);
  ensureSheet(SHEETS.SESSIONS, ['token','userId','role','coopId','expiry']);

  // seed Users
  var userSheet = ss.getSheetByName(SHEETS.USERS);
  if (userSheet.getLastRow() <= 1) {
    userSheet.appendRow(['U001','admin','admin1234','ผู้ดูแลระบบ','admin','','TRUE']);
    userSheet.appendRow(['U002','officer1','1234','เจ้าหน้าที่สหกรณ์ 1','officer','C01','TRUE']);
  }

  // seed Cooperatives
  var coopSheet = ss.getSheetByName(SHEETS.COOPS);
  if (coopSheet.getLastRow() <= 1) {
    coopSheet.appendRow(['C01','สหกรณ์การเกษตรเชียงใหม่ จำกัด','เกษตร','TRUE']);
  }

  Logger.log('Setup สำเร็จ! login: admin / admin1234');
}

// ============================================================
//  FIX LOGIN — รันถ้า login ไม่ได้ เพื่อ reset Users sheet
// ============================================================
function fixLogin() {
  var ss    = SpreadsheetApp.openById(SHEET_ID);
  var sheet = ss.getSheetByName(SHEETS.USERS);
  if (!sheet) sheet = ss.insertSheet(SHEETS.USERS);
  sheet.clearContents();
  sheet.appendRow(['ID','username','password','name','role','coopId','active']);
  sheet.appendRow(['U001','admin','admin1234','ผู้ดูแลระบบ','admin','','TRUE']);
  sheet.appendRow(['U002','officer1','1234','เจ้าหน้าที่สหกรณ์ 1','officer','C01','TRUE']);
  sheet.getRange(1, 1, 1, 7)
    .setBackground('#4A86E8')
    .setFontColor('#FFFFFF')
    .setFontWeight('bold');
  Logger.log('fixLogin สำเร็จ! login: admin / admin1234 | officer1 / 1234');
}

// ============================================================
//  TEST FUNCTIONS — ใช้ debug ใน Script Editor
// ============================================================
function testLogin() {
  var result = login('admin', 'admin1234');
  Logger.log(JSON.stringify(result));
}

function testDoPost() {
  var fakeEvent = {
    postData: {
      contents: JSON.stringify({
        action: 'login',
        args: ['admin', 'admin1234']
      })
    }
  };
  var result = doPost(fakeEvent);
  Logger.log(result.getContent());
}

// ============================================================
//  UTILITIES
// ============================================================
function formatDate(val) {
  if (!val) return '';
  if (val instanceof Date) {
    return Utilities.formatDate(val, 'Asia/Bangkok', 'yyyy-MM-dd');
  }
  return String(val);
}
