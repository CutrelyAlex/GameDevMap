/**
 * 全局调试面板 - 适用于所有页面
 * 右上角一个小按钮，点击展开/收起
 */

let debugPanel = null;
let debugButton = null;
let isDebugPanelOpen = false;

function initDebugPanel() {
  // 创建调试按钮
  debugButton = document.createElement('button');
  debugButton.id = 'debugPanelToggle';
  debugButton.textContent = '🐛';
  debugButton.title = '点击打开/关闭调试面板';
  debugButton.style.cssText = `
    position: fixed;
    top: 10px;
    left: 10px;
    width: 40px;
    height: 40px;
    border-radius: 50%;
    background: #ff6b6b;
    color: white;
    border: 2px solid #ff5252;
    cursor: pointer;
    font-size: 20px;
    z-index: 99998;
    box-shadow: 0 2px 8px rgba(0,0,0,0.2);
    transition: all 0.3s ease;
    font-weight: bold;
  `;
  
  debugButton.onmouseover = function() {
    this.style.background = '#ff5252';
    this.style.transform = 'scale(1.1)';
  };
  
  debugButton.onmouseout = function() {
    this.style.background = '#ff6b6b';
    this.style.transform = 'scale(1)';
  };
  
  // 创建调试面板
  debugPanel = document.createElement('div');
  debugPanel.id = 'debugPanel';
  debugPanel.style.cssText = `
    position: fixed;
    top: 60px;
    left: 10px;
    width: 450px;
    max-height: 400px;
    background: #1e1e1e;
    color: #00ff00;
    border: 2px solid #00ff00;
    border-radius: 8px;
    padding: 12px;
    font-family: 'Courier New', monospace;
    font-size: 12px;
    overflow-y: auto;
    z-index: 99999;
    box-shadow: 0 0 15px rgba(0, 255, 0, 0.3);
    display: none;
  `;
  
  // 添加标题栏
  const titleBar = document.createElement('div');
  titleBar.style.cssText = `
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 10px;
    padding-bottom: 8px;
    border-bottom: 1px solid #00ff00;
  `;
  
  const title = document.createElement('span');
  title.textContent = '🔍 调试面板';
  title.style.fontWeight = 'bold';
  
  const clearBtn = document.createElement('button');
  clearBtn.textContent = '清空';
  clearBtn.style.cssText = `
    background: #00ff00;
    color: #1e1e1e;
    border: none;
    padding: 4px 8px;
    border-radius: 4px;
    cursor: pointer;
    font-size: 11px;
    font-weight: bold;
  `;
  clearBtn.onclick = function() {
    debugPanel.innerHTML = '';
    debugPanel.appendChild(titleBar);
  };
  
  titleBar.appendChild(title);
  titleBar.appendChild(clearBtn);
  debugPanel.appendChild(titleBar);
  
  // 按钮点击处理
  debugButton.onclick = function() {
    isDebugPanelOpen = !isDebugPanelOpen;
    debugPanel.style.display = isDebugPanelOpen ? 'block' : 'none';
    debugButton.style.background = isDebugPanelOpen ? '#51cf66' : '#ff6b6b';
  };
  
  // 添加到页面
  try {
    document.body.appendChild(debugButton);
    document.body.appendChild(debugPanel);
  } catch (e) {
    // document.body 还不存在，使用 DOMContentLoaded
    document.addEventListener('DOMContentLoaded', function() {
      if (!debugButton.parentNode) {
        document.body.appendChild(debugButton);
        document.body.appendChild(debugPanel);
      }
    });
  }
}

// 添加调试日志
function addDebugLog(message) {
  if (!debugPanel) {
    initDebugPanel();
  }
  
  const timestamp = new Date().toLocaleTimeString();
  const logLine = document.createElement('div');
  logLine.style.cssText = `
    margin-bottom: 6px;
    padding-bottom: 6px;
    border-bottom: 1px solid #333;
    word-break: break-word;
  `;
  logLine.textContent = `[${timestamp}] ${message}`;
  debugPanel.appendChild(logLine);
  debugPanel.scrollTop = debugPanel.scrollHeight;
  console.log(message);
}

// 初始化
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initDebugPanel);
} else {
  initDebugPanel();
}

// 导出到全局作用域
window.addDebugLog = addDebugLog;
window.initDebugPanel = initDebugPanel;
