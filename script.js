/**
 * 賴冠宏專屬網站 | Main JavaScript
 * Features:
 * 1. Ambient Golden Dust Canvas
 * 2. Sticky Header & Mobile Drawer
 * 3. LocalStorage Activity Store (with 2 Pre-seeded Demo Activities)
 * 4. Step-by-Step Activity Creator (Step 1: Info -> Step 2: Options -> Step 3: Read-only Confirmation)
 * 5. Instant JPG/PNG/WEBP Image Upload & Preset Cover Fallback
 * 6. Dynamic Gathering Cards under Hero (✨ 正在揪團) with 16:9 Aspect Ratio & Hover Micro-float
 * 7. Activity Detail & Selection (Voting) Feature:
 *    - View Cover, Title, Host, Deadline, Status
 *    - Real-time display of Option voter counts & ALL friend names (誰選了什麼)
 *    - "我要選擇" interactive flow: Input name -> Multi-select options -> Submit
 *    - Duplicate prevention: Alerts "你已經完成選擇。" if same name submits again
 *    - Immutable rules: friends cannot modify activity title, options, deadline, or others' votes
 * 8. LocalStorage Selections persistence (activityId, optionId, userName, createdAt)
 * 9. Toast Notifications
 */

// Storage Keys
const STORAGE_KEY_ACTIVITIES = 'LGH_EXCLUSIVE_GATHERINGS_V1';
const STORAGE_KEY_SELECTIONS = 'LGH_EXCLUSIVE_SELECTIONS_V1';
const STORAGE_KEY_MESSAGES = 'LGH_EXCLUSIVE_MESSAGES_V1';
const STORAGE_KEY_CHAT_USER = 'LGH_EXCLUSIVE_CHAT_USER_V1';
const STORAGE_KEY_PHOTOS = 'LGH_EXCLUSIVE_PHOTOS_V1';

document.addEventListener('DOMContentLoaded', () => {
  initAmbientParticles();
  initHeaderScroll();
  initMobileDrawer();
  initGatheringsManager();
  initSmoothScrollSpy();
});

/* ==========================================================================
   1. Luxury Ambient Particle System (Golden Dust Canvas)
   ========================================================================== */
function initAmbientParticles() {
  const canvas = document.getElementById('particleCanvas');
  if (!canvas) return;

  const ctx = canvas.getContext('2d');
  let width, height;
  let particles = [];
  const PARTICLE_COUNT = 36;

  function resizeCanvas() {
    width = canvas.width = window.innerWidth;
    height = canvas.height = window.innerHeight;
  }

  window.addEventListener('resize', resizeCanvas);
  resizeCanvas();

  class Particle {
    constructor() {
      this.reset(true);
    }

    reset(initial = false) {
      this.x = Math.random() * width;
      this.y = initial ? Math.random() * height : height + 10;
      this.radius = Math.random() * 1.5 + 0.5;
      this.speedY = -(Math.random() * 0.3 + 0.12);
      this.speedX = (Math.random() - 0.5) * 0.2;
      this.alpha = Math.random() * 0.5 + 0.15;
      this.fadeSpeed = Math.random() * 0.003 + 0.002;
      this.isFading = Math.random() > 0.5;
    }

    update() {
      this.x += this.speedX;
      this.y += this.speedY;

      if (this.isFading) {
        this.alpha -= this.fadeSpeed;
        if (this.alpha <= 0.1) this.isFading = false;
      } else {
        this.alpha += this.fadeSpeed;
        if (this.alpha >= 0.6) this.isFading = true;
      }

      if (this.y < -10 || this.x < -10 || this.x > width + 10) {
        this.reset();
      }
    }

    draw() {
      ctx.beginPath();
      ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(245, 215, 127, ${this.alpha})`;
      ctx.shadowBlur = 6;
      ctx.shadowColor = 'rgba(212, 175, 55, 0.4)';
      ctx.fill();
    }
  }

  for (let i = 0; i < PARTICLE_COUNT; i++) {
    particles.push(new Particle());
  }

  function animate() {
    ctx.clearRect(0, 0, width, height);
    particles.forEach(p => {
      p.update();
      p.draw();
    });
    requestAnimationFrame(animate);
  }

  animate();
}

/* ==========================================================================
   2. Header Scroll & Mobile Drawer
   ========================================================================== */
function initHeaderScroll() {
  const header = document.getElementById('siteHeader');
  if (!header) return;

  const handleScroll = () => {
    if (window.scrollY > 40) {
      header.classList.add('scrolled');
    } else {
      header.classList.remove('scrolled');
    }
  };

  window.addEventListener('scroll', handleScroll, { passive: true });
  handleScroll();
}

function initMobileDrawer() {
  const hamburgerBtn = document.getElementById('hamburgerBtn');
  const mobileDrawer = document.getElementById('mobileDrawer');
  const drawerCloseBtn = document.getElementById('drawerCloseBtn');
  const mobileLinks = document.querySelectorAll('.mobile-nav-link');
  const mobileCreateBtn = document.getElementById('btnOpenCreateModalMobile');

  if (!hamburgerBtn || !mobileDrawer) return;

  function openDrawer() {
    mobileDrawer.classList.add('open');
    hamburgerBtn.classList.add('is-active');
    hamburgerBtn.setAttribute('aria-expanded', 'true');
    mobileDrawer.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';
  }

  function closeDrawer() {
    mobileDrawer.classList.remove('open');
    hamburgerBtn.classList.remove('is-active');
    hamburgerBtn.setAttribute('aria-expanded', 'false');
    mobileDrawer.setAttribute('aria-hidden', 'true');
    document.body.style.overflow = '';
  }

  hamburgerBtn.addEventListener('click', () => {
    if (mobileDrawer.classList.contains('open')) {
      closeDrawer();
    } else {
      openDrawer();
    }
  });

  if (drawerCloseBtn) drawerCloseBtn.addEventListener('click', closeDrawer);

  mobileDrawer.addEventListener('click', (e) => {
    if (e.target === mobileDrawer) closeDrawer();
  });

  mobileLinks.forEach(link => link.addEventListener('click', closeDrawer));

  if (mobileCreateBtn) {
    mobileCreateBtn.addEventListener('click', () => {
      closeDrawer();
    });
  }
}

/* ==========================================================================
   3. Gatherings Store & Activity Selection Manager
   ========================================================================== */
function initGatheringsManager() {
  // Activity, Selections, and Photos Storage State
  let activities = loadActivities();
  let selections = loadSelections();
  let photos = loadPhotos();

  // 註冊 Supabase 雲端資料庫雙向同步
  initSupabaseCloudSync({
    onActivitiesSync: (cloudActivities) => {
      activities = cloudActivities;
      saveActivities(activities);
      renderGatheringCards();
      if (currentViewingActivityId) {
        const act = activities.find(a => a.id === currentViewingActivityId);
        if (act) renderDetailOptionsAndVoters(act);
      }
    },
    onSelectionsSync: (cloudSelections) => {
      selections = cloudSelections;
      saveSelections(selections);
      if (currentViewingActivityId) {
        const act = activities.find(a => a.id === currentViewingActivityId);
        if (act) renderDetailOptionsAndVoters(act);
      }
      renderGatheringCards();
    }
  });

  // Temporary wizard state
  let currentStep = 1;
  let customCoverDataUrl = '';
  let currentOptions = [];

  // Detail modal state
  let currentViewingActivityId = null;

  // DOM Elements - Main View
  const gridContainer = document.getElementById('activityGridContainer');
  const createModal = document.getElementById('createModal');
  const viewModal = document.getElementById('viewActivityModal');

  // Trigger buttons
  const triggerCreateBtns = [
    document.getElementById('btnOpenCreateModalHeader'),
    document.getElementById('btnOpenCreateModalHero'),
    document.getElementById('btnOpenCreateModalGathering'),
    document.getElementById('btnOpenCreateModalMobile'),
  ];

  // Wizard Elements
  const creatorInput = document.getElementById('creatorInput');
  const titleInput = document.getElementById('titleInput');
  const coverFileInput = document.getElementById('coverFileInput');
  const uploaderIdleState = document.getElementById('uploaderIdleState');
  const uploaderPreviewState = document.getElementById('uploaderPreviewState');
  const coverPreviewImg = document.getElementById('coverPreviewImg');
  const btnRemoveCover = document.getElementById('btnRemoveCover');
  const deadlineInput = document.getElementById('deadlineInput');

  // Step Indicators & Panels
  const stepPanels = [
    document.getElementById('stepPanel1'),
    document.getElementById('stepPanel2'),
    document.getElementById('stepPanel3'),
  ];
  const stepIndicators = [
    document.getElementById('stepIndicator1'),
    document.getElementById('stepIndicator2'),
    document.getElementById('stepIndicator3'),
  ];
  const stepConnectors = [
    document.getElementById('stepConnector1'),
    document.getElementById('stepConnector2'),
  ];

  // Step 1 buttons
  const btnStep1Next = document.getElementById('btnStep1Next');
  const btnCancelStepModal = document.getElementById('btnCancelStepModal');

  // Step 2 buttons & inputs
  const optionTextInput = document.getElementById('optionTextInput');
  const btnAddOption = document.getElementById('btnAddOption');
  const optionsListContainer = document.getElementById('optionsListContainer');
  const optionsCounter = document.getElementById('optionsCounter');
  const presetChips = document.querySelectorAll('.preset-chip');
  const btnStep2Prev = document.getElementById('btnStep2Prev');
  const btnStep2Next = document.getElementById('btnStep2Next');

  // Step 3 buttons & preview elements
  const reviewCoverImg = document.getElementById('reviewCoverImg');
  const reviewTitle = document.getElementById('reviewTitle');
  const reviewCreator = document.getElementById('reviewCreator');
  const reviewDeadline = document.getElementById('reviewDeadline');
  const reviewOptionsChips = document.getElementById('reviewOptionsChips');
  const btnStep3Prev = document.getElementById('btnStep3Prev');
  const btnFinalCreate = document.getElementById('btnFinalCreate');

  // Detail Modal Elements
  const modalCloseBtn = document.getElementById('modalCloseBtn');
  const viewModalCloseBtn = document.getElementById('viewModalCloseBtn');
  const btnCloseViewModal = document.getElementById('btnCloseViewModal');

  // Detail Voting Form Elements
  const btnToggleVoteForm = document.getElementById('btnToggleVoteForm');
  const voteFormSection = document.getElementById('voteFormSection');
  const voterNameInput = document.getElementById('voterNameInput');
  const voterCheckboxList = document.getElementById('voterCheckboxList');
  const btnSubmitVote = document.getElementById('btnSubmitVote');
  const voteFeedbackMsg = document.getElementById('voteFeedbackMsg');

  // Chatroom Elements (💬 活動聊天室)
  const chatMessageCountBadge = document.getElementById('chatMessageCountBadge');
  const currentChatUserDisplay = document.getElementById('currentChatUserDisplay');
  const btnSwitchChatIdentity = document.getElementById('btnSwitchChatIdentity');
  const chatStreamContainer = document.getElementById('chatStreamContainer');
  const chatInputForm = document.getElementById('chatInputForm');
  const chatTextInput = document.getElementById('chatTextInput');
  const btnSendMessage = document.getElementById('btnSendMessage');

  // Chat Identity Modal Elements
  const chatNameModal = document.getElementById('chatNameModal');
  const btnCloseChatNameModal = document.getElementById('btnCloseChatNameModal');
  const btnCancelChatName = document.getElementById('btnCancelChatName');
  const chatNameForm = document.getElementById('chatNameForm');
  const chatUserNameInput = document.getElementById('chatUserNameInput');
  const btnConfirmChatName = document.getElementById('btnConfirmChatName');

  // Chat State
  let messages = loadMessages();
  let currentChatUser = loadChatUser();

  // Set default deadline to 7 days from now
  setDefaultDeadlineInput();

  // Initial render of home page activity cards
  renderGatheringCards();

  /* ------------------- Open / Close Create Modal ------------------- */
  function openCreateModal() {
    resetWizard();
    createModal.classList.add('open');
    createModal.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';
    setTimeout(() => {
      if (titleInput) titleInput.focus();
    }, 150);
  }

  function closeCreateModal() {
    createModal.classList.remove('open');
    createModal.setAttribute('aria-hidden', 'true');
    document.body.style.overflow = '';
  }

  triggerCreateBtns.forEach(btn => {
    if (btn) btn.addEventListener('click', openCreateModal);
  });

  if (modalCloseBtn) modalCloseBtn.addEventListener('click', closeCreateModal);
  if (btnCancelStepModal) btnCancelStepModal.addEventListener('click', closeCreateModal);

  createModal.addEventListener('click', (e) => {
    if (e.target === createModal) closeCreateModal();
  });

  /* ------------------- Step Wizard Navigation ------------------- */
  function goToStep(step) {
    currentStep = step;

    stepPanels.forEach((panel, idx) => {
      if (idx + 1 === step) {
        panel.style.display = 'flex';
        panel.classList.add('active');
      } else {
        panel.style.display = 'none';
        panel.classList.remove('active');
      }
    });

    stepIndicators.forEach((indicator, idx) => {
      const num = idx + 1;
      indicator.classList.remove('active', 'completed');
      if (num === step) {
        indicator.classList.add('active');
      } else if (num < step) {
        indicator.classList.add('completed');
      }
    });

    stepConnectors.forEach((conn, idx) => {
      if (idx + 1 < step) {
        conn.classList.add('filled');
      } else {
        conn.classList.remove('filled');
      }
    });
  }

  function resetWizard() {
    goToStep(1);
    if (titleInput) titleInput.value = '';
    if (creatorInput) creatorInput.value = '冠宏';
    setDefaultDeadlineInput();
    clearCoverUpload();
    currentOptions = [];
    renderOptionsList();
  }

  function setDefaultDeadlineInput() {
    if (!deadlineInput) return;
    const now = new Date();
    now.setDate(now.getDate() + 7);
    now.setHours(23, 59, 0, 0);

    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');

    deadlineInput.value = `${year}-${month}-${day}T${hours}:${minutes}`;
  }

  /* ------------------- Image Upload Handling ------------------- */
  if (coverFileInput) {
    coverFileInput.addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (!file) return;

      if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
        showToast('⚠️ 僅支援 JPG、PNG、WEBP 格式圖片');
        coverFileInput.value = '';
        return;
      }

      const reader = new FileReader();
      reader.onload = (loadEvt) => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');
          const maxW = 960;
          let targetW = img.width;
          let targetH = img.height;

          if (targetW > maxW) {
            targetH = Math.round((targetH * maxW) / targetW);
            targetW = maxW;
          }

          canvas.width = targetW;
          canvas.height = targetH;
          const ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0, targetW, targetH);

          customCoverDataUrl = canvas.toDataURL('image/jpeg', 0.85);

          coverPreviewImg.src = customCoverDataUrl;
          uploaderIdleState.style.display = 'none';
          uploaderPreviewState.style.display = 'block';
        };
        img.src = loadEvt.target.result;
      };
      reader.readAsDataURL(file);
    });
  }

  if (btnRemoveCover) {
    btnRemoveCover.addEventListener('click', (e) => {
      e.stopPropagation();
      clearCoverUpload();
    });
  }

  function clearCoverUpload() {
    customCoverDataUrl = '';
    if (coverFileInput) coverFileInput.value = '';
    if (coverPreviewImg) coverPreviewImg.src = '';
    if (uploaderIdleState) uploaderIdleState.style.display = 'block';
    if (uploaderPreviewState) uploaderPreviewState.style.display = 'none';
  }

  /* ------------------- Step 1 -> Step 2 Validation ------------------- */
  if (btnStep1Next) {
    btnStep1Next.addEventListener('click', () => {
      const creator = creatorInput.value.trim();
      const title = titleInput.value.trim();
      const deadline = deadlineInput.value;

      if (!creator) {
        showToast('⚠️ 請輸入建立人姓名（例如：冠宏）');
        creatorInput.focus();
        return;
      }

      if (!title) {
        showToast('⚠️ 請輸入活動標題');
        titleInput.focus();
        return;
      }

      if (!deadline) {
        showToast('⚠️ 請選擇活動截止日期與時間');
        deadlineInput.focus();
        return;
      }

      goToStep(2);
      if (optionTextInput) setTimeout(() => optionTextInput.focus(), 150);
    });
  }

  /* ------------------- Step 2: Options Management ------------------- */
  function addOption(text) {
    const trimmed = text.trim();
    if (!trimmed) return;

    if (currentOptions.includes(trimmed)) {
      showToast('⚠️ 此選項已在清單中');
      return;
    }

    currentOptions.push(trimmed);
    renderOptionsList();
    if (optionTextInput) {
      optionTextInput.value = '';
      optionTextInput.focus();
    }
  }

  if (btnAddOption) {
    btnAddOption.addEventListener('click', () => {
      addOption(optionTextInput.value);
    });
  }

  if (optionTextInput) {
    optionTextInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        addOption(optionTextInput.value);
      }
    });
  }

  presetChips.forEach(chip => {
    chip.addEventListener('click', () => {
      const text = chip.getAttribute('data-text');
      addOption(text);
    });
  });

  function renderOptionsList() {
    if (!optionsListContainer) return;
    optionsListContainer.innerHTML = '';

    if (currentOptions.length === 0) {
      optionsListContainer.innerHTML = `
        <div style="text-align: center; padding: 18px 10px; color: var(--text-muted); font-size: 0.88rem;">
          尚未新增選項。請在上方輸入，或點選常用靈感快速加入！
        </div>
      `;
    } else {
      currentOptions.forEach((opt, index) => {
        const row = document.createElement('div');
        row.className = 'option-item-row';
        row.innerHTML = `
          <span class="option-item-text">${index + 1}. ${escapeHTML(opt)}</span>
          <button type="button" class="btn-delete-option" title="刪除此選項" data-index="${index}">✕</button>
        `;
        optionsListContainer.appendChild(row);
      });

      const deleteBtns = optionsListContainer.querySelectorAll('.btn-delete-option');
      deleteBtns.forEach(btn => {
        btn.addEventListener('click', (e) => {
          const idx = parseInt(e.currentTarget.getAttribute('data-index'), 10);
          currentOptions.splice(idx, 1);
          renderOptionsList();
        });
      });
    }

    if (optionsCounter) {
      optionsCounter.textContent = `${currentOptions.length} 個選項`;
    }
  }

  if (btnStep2Prev) {
    btnStep2Prev.addEventListener('click', () => goToStep(1));
  }

  if (btnStep2Next) {
    btnStep2Next.addEventListener('click', () => {
      if (currentOptions.length === 0) {
        showToast('⚠️ 請至少新增 1 個活動選項供好友選擇！');
        if (optionTextInput) optionTextInput.focus();
        return;
      }

      populateStep3Review();
      goToStep(3);
    });
  }

  /* ------------------- Step 3: Populate & Final Create ------------------- */
  function populateStep3Review() {
    const title = titleInput.value.trim();
    const creator = creatorInput.value.trim();
    const deadlineVal = deadlineInput.value;
    const coverUrl = customCoverDataUrl || generateLuxurySvgCover(title, currentOptions[0] || '聚會');

    if (reviewCoverImg) reviewCoverImg.src = coverUrl;
    if (reviewTitle) reviewTitle.textContent = title;
    if (reviewCreator) reviewCreator.textContent = creator;
    if (reviewDeadline) reviewDeadline.textContent = formatDateTime(deadlineVal);

    if (reviewOptionsChips) {
      reviewOptionsChips.innerHTML = currentOptions.map(opt => `
        <span class="review-chip">${escapeHTML(opt)}</span>
      `).join('');
    }
  }

  if (btnStep3Prev) {
    btnStep3Prev.addEventListener('click', () => goToStep(2));
  }

  if (btnFinalCreate) {
    btnFinalCreate.addEventListener('click', () => {
      const title = titleInput.value.trim();
      const creator = creatorInput.value.trim();
      const deadlineVal = deadlineInput.value;
      const coverUrl = customCoverDataUrl || generateLuxurySvgCover(title, currentOptions[0] || '聚會');

      const newActivity = {
        id: 'lgh_act_' + Date.now(),
        title: title,
        creator: creator,
        cover: coverUrl,
        deadline: deadlineVal,
        options: [...currentOptions],
        createdAt: new Date().toISOString(),
        isReadOnly: true // Immutable as requested
      };

      activities.unshift(newActivity);
      saveActivities(activities);

      renderGatheringCards();

      // 雲端資料庫即時同步（寫入 Supabase）
      syncNewActivityToCloud(newActivity);

      closeCreateModal();
      showToast(`✨「${title}」已成功建立並發布在『正在揪團』！`);

      const gatheringSection = document.getElementById('gatherings');
      if (gatheringSection) {
        setTimeout(() => {
          gatheringSection.scrollIntoView({ behavior: 'smooth' });
        }, 200);
      }
    });
  }

  /* ------------------- Render Gathering Cards (Separated into Active & Archived) ------------------- */
  function renderGatheringCards() {
    const activeGrid = document.getElementById('activityGridContainer');
    const archivedGrid = document.getElementById('archivedGridContainer');
    const archivedCounter = document.getElementById('archivedCounter');

    if (activeGrid) activeGrid.innerHTML = '';
    if (archivedGrid) archivedGrid.innerHTML = '';

    const now = new Date();

    // Split activities into Active (正在揪團) and Archived (回憶紀錄)
    const activeActivities = activities.filter(act => {
      const d = new Date(act.deadline);
      return isNaN(d.getTime()) || d > now;
    });

    const archivedActivities = activities.filter(act => {
      const d = new Date(act.deadline);
      return !isNaN(d.getTime()) && d <= now;
    });

    // Update Archived Counter
    if (archivedCounter) {
      archivedCounter.textContent = `共 ${archivedActivities.length} 場歷史回憶`;
    }

    // 1. Render Active Activities (✨ 正在揪團)
    if (activeGrid) {
      if (activeActivities.length === 0) {
        activeGrid.innerHTML = `
          <div style="grid-column: 1 / -1; text-align: center; padding: 48px 20px; background: rgba(255,255,255,0.02); border-radius: 16px; border: 1px dashed var(--glass-border);">
            <p style="color: var(--text-secondary); font-size: 1.05rem; margin-bottom: 12px;">目前尚未有進行中的揪團活動</p>
            <button class="btn-create-secondary" onclick="document.getElementById('btnOpenCreateModalGathering').click()">＋ 立即發起新揪團</button>
          </div>
        `;
      } else {
        activeActivities.forEach((act, idx) => {
          const cardEl = createActivityCardElement(act, false);
          cardEl.style.animationDelay = `${idx * 0.08}s`;
          activeGrid.appendChild(cardEl);
        });
      }
    }

    // 2. Render Archived Activities (📖 回憶紀錄)
    if (archivedGrid) {
      if (archivedActivities.length === 0) {
        archivedGrid.innerHTML = `
          <div style="grid-column: 1 / -1; text-align: center; padding: 36px 20px; background: rgba(255,255,255,0.02); border-radius: 16px; border: 1px dashed var(--glass-border);">
            <p style="color: var(--text-secondary); font-size: 0.96rem;">尚無已截止的活動回憶紀錄</p>
          </div>
        `;
      } else {
        archivedActivities.forEach((act, idx) => {
          const cardEl = createActivityCardElement(act, true);
          cardEl.style.animationDelay = `${idx * 0.08}s`;
          archivedGrid.appendChild(cardEl);
        });
      }
    }

    // Bind "查看活動" clicks across all cards
    document.querySelectorAll('.btn-view-activity').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.getAttribute('data-id');
        openViewActivityModal(id);
      });
    });
  }

  // Helper to build Card DOM
  function createActivityCardElement(act, isExpired) {
    const statusText = isExpired ? '⚫ 活動已結束' : '🟢 選擇進行中';
    const statusClass = isExpired ? 'ended' : 'active';

    // Count unique voters for this activity
    const actSelections = selections.filter(s => s.activityId === act.id);
    const uniqueVoterNames = [...new Set(actSelections.map(s => s.userName))];

    // Count photos for this activity
    const actPhotos = photos.filter(p => p.activityId === act.id);

    const card = document.createElement('article');
    card.className = 'activity-card';
    card.setAttribute('data-id', act.id);

    const optionsPreviewHtml = act.options && act.options.length > 0
      ? act.options.slice(0, 3).map(opt => `<span class="activity-option-tag">${escapeHTML(opt)}</span>`).join('') +
        (act.options.length > 3 ? `<span class="activity-option-tag">+${act.options.length - 3}</span>` : '')
      : '';

    // If expired, show memory photos count in meta list
    const memoryPhotoMeta = isExpired
      ? `
        <div class="activity-meta-item">
          <span class="meta-icon">📸</span>
          <span>照片數量：<strong class="meta-highlight">📸 ${actPhotos.length} 張照片</strong></span>
        </div>
      `
      : '';

    card.innerHTML = `
      <div class="activity-cover-wrap">
        <img src="${act.cover}" alt="${escapeHTML(act.title)}" class="activity-cover-img" loading="lazy">
        <div class="activity-status-badge ${statusClass}">
          ${statusText}
        </div>
      </div>
      <div class="activity-card-body">
        <h3 class="activity-card-title">${escapeHTML(act.title)}</h3>
        
        <div class="activity-meta-list">
          <div class="activity-meta-item">
            <span class="meta-icon">👑</span>
            <span>建立人：<strong class="meta-highlight">${escapeHTML(act.creator)}</strong></span>
          </div>
          <div class="activity-meta-item">
            <span class="meta-icon">⏰</span>
            <span>截止日期：<span class="meta-highlight">${escapeHTML(formatDateTime(act.deadline))}</span></span>
          </div>
          <div class="activity-meta-item">
            <span class="meta-icon">👥</span>
            <span>${isExpired ? '選擇結果：' : '已選擇好友：'}<strong class="meta-highlight">${uniqueVoterNames.length} 位好友</strong></span>
          </div>
          ${memoryPhotoMeta}
        </div>

        <div class="activity-options-preview">
          ${optionsPreviewHtml}
        </div>

        <div class="activity-card-footer">
          <span class="activity-host-badge">${isExpired ? `📸 ${actPhotos.length} 張照片` : `共 ${act.options.length} 項選項`}</span>
          <button type="button" class="btn-view-activity ${isExpired ? 'btn-view-memories' : ''}" data-id="${act.id}">
            <span>${isExpired ? '查看回憶' : '查看活動'}</span>
            <span style="font-size: 0.95rem;">→</span>
          </button>
        </div>
      </div>
    `;

    return card;
  }

  /* ==========================================================================
     Activity Detail & Voting (Selection) Modal
     ========================================================================== */
  function openViewActivityModal(id) {
    currentViewingActivityId = id;
    const act = activities.find(item => item.id === id);
    if (!act || !viewModal) return;

    const coverElem = document.getElementById('viewActivityCover');
    const titleElem = document.getElementById('viewModalTitle');
    const creatorElem = document.getElementById('viewActivityCreator');
    const deadlineElem = document.getElementById('viewActivityDeadline');
    const statusBadge = document.getElementById('viewActivityStatusBadge');
    const countBadge = document.getElementById('viewActivityOptionsCount');
    const expiredBanner = document.getElementById('expiredActivityBanner');

    const now = new Date();
    const deadlineDate = new Date(act.deadline);
    const isExpired = !isNaN(deadlineDate.getTime()) && deadlineDate <= now;

    if (coverElem) coverElem.src = act.cover;
    if (titleElem) titleElem.textContent = act.title;
    if (creatorElem) creatorElem.textContent = `👑 發起人：${act.creator}`;
    if (deadlineElem) deadlineElem.textContent = `📅 截止時間：${formatDateTime(act.deadline)}`;

    // Update status badge: 🟢 選擇進行中 vs 🔒 選擇已結束
    if (statusBadge) {
      statusBadge.textContent = isExpired ? '🔒 選擇已結束' : '🟢 選擇進行中';
      statusBadge.className = `view-status-pill ${isExpired ? 'ended' : ''}`;
    }

    if (countBadge) {
      countBadge.textContent = `${act.options.length} 個選項`;
    }

    // Reset feedback message & inputs
    if (voteFeedbackMsg) {
      voteFeedbackMsg.style.display = 'none';
      voteFeedbackMsg.className = 'vote-feedback';
      voteFeedbackMsg.innerHTML = '';
    }
    if (voterNameInput) voterNameInput.value = '';

    // Handle expired UI state:
    // If expired: show expired banner, hide voting form, disable trigger button
    if (isExpired) {
      if (expiredBanner) expiredBanner.style.display = 'flex';
      if (voteFormSection) voteFormSection.style.display = 'none';
      if (btnToggleVoteForm) {
        btnToggleVoteForm.disabled = true;
        btnToggleVoteForm.classList.add('disabled');
        btnToggleVoteForm.innerHTML = '<span>🔒 本活動選擇已截止</span>';
      }
    } else {
      if (expiredBanner) expiredBanner.style.display = 'none';
      if (voteFormSection) voteFormSection.style.display = 'flex';
      if (btnToggleVoteForm) {
        btnToggleVoteForm.disabled = false;
        btnToggleVoteForm.classList.remove('disabled');
        btnToggleVoteForm.innerHTML = '<span class="btn-icon">＋</span><span>我要參與選擇</span>';
      }
    }

    // Render detail options and real-time voter names
    renderDetailOptionsAndVoters(act);

    // Render activity chatroom messages (💬 活動聊天室)
    renderActivityChat(act.id);
    if (chatTextInput) chatTextInput.value = '';

    // Render activity memory photos (📸 活動回憶)
    renderActivityPhotos(act.id, isExpired);

    viewModal.classList.add('open');
    viewModal.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';
  }

  function renderDetailOptionsAndVoters(act) {
    if (!act) return;

    // Filter selections for this activity
    const actSelections = selections.filter(s => s.activityId === act.id);
    const uniqueVoterNames = [...new Set(actSelections.map(s => s.userName))];

    // Update Summary Header
    const votersSummaryText = document.getElementById('votersSummaryText');
    if (votersSummaryText) {
      votersSummaryText.textContent = `目前共 ${uniqueVoterNames.length} 位好友已參與選擇`;
    }

    // Render multi-select checkboxes inside vote form
    if (voterCheckboxList) {
      voterCheckboxList.innerHTML = '';
      act.options.forEach(opt => {
        const card = document.createElement('div');
        card.className = 'voter-checkbox-card';
        card.setAttribute('data-option', opt);
        card.innerHTML = `
          <div class="custom-checkbox-indicator"></div>
          <span class="voter-checkbox-text">${escapeHTML(opt)}</span>
        `;

        card.addEventListener('click', () => {
          card.classList.toggle('selected');
          const checkInd = card.querySelector('.custom-checkbox-indicator');
          if (card.classList.contains('selected')) {
            checkInd.textContent = '✓';
          } else {
            checkInd.textContent = '';
          }
        });

        voterCheckboxList.appendChild(card);
      });
    }

    const now = new Date();
    const dDate = new Date(act.deadline);
    const isExpired = !isNaN(dDate.getTime()) && dDate <= now;

    // Render Real-time Options & Names list (誰選了什麼)
    const optionsContainer = document.getElementById('viewActivityOptionsContainer');
    if (optionsContainer) {
      optionsContainer.innerHTML = '';

      act.options.forEach((opt, i) => {
        // Find all voters who chose this option
        const optVoters = actSelections
          .filter(s => s.optionId === opt)
          .map(s => s.userName);

        const card = document.createElement('div');
        card.className = 'option-voter-card';

        // Voter name badges HTML
        let voterChipsHtml = '';
        if (optVoters.length > 0) {
          voterChipsHtml = optVoters.map(name => `
            <span class="voter-name-chip">
              <span class="voter-chip-avatar">${escapeHTML(name.charAt(0))}</span>
              <span>${escapeHTML(name)}</span>
            </span>
          `).join('');
        } else {
          voterChipsHtml = `<span class="no-voters-hint">尚無好友選擇，點擊「我要選擇」成為第一位！</span>`;
        }

        card.innerHTML = `
          <div class="option-voter-header">
            <div class="option-title-wrap">
              <span class="option-index-badge">0${i + 1}</span>
              <h4 class="option-main-title">${escapeHTML(opt)}</h4>
            </div>
            <div class="option-header-actions">
              <span class="voter-count-badge">目前 ${optVoters.length} 人選擇</span>
              <button type="button" class="btn-choose-this ${isExpired ? 'disabled' : ''}" data-option="${escapeHTML(opt)}" ${isExpired ? 'disabled title="本活動選擇已截止"' : ''}>
                ${isExpired ? '已截止' : '我要選擇'}
              </button>
            </div>
          </div>

          <div class="voter-names-block">
            <span class="voter-names-label">選擇好友：</span>
            <div class="voter-chips-wrap">
              ${voterChipsHtml}
            </div>
          </div>
        `;

        // Click on "我要選擇" button on individual card
        const chooseBtn = card.querySelector('.btn-choose-this');
        if (chooseBtn && !isExpired) {
          chooseBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            const targetOpt = chooseBtn.getAttribute('data-option');
            preselectOptionInForm(targetOpt);
          });
        }

        optionsContainer.appendChild(card);
      });
    }
  }

  // Pre-select an option and scroll down to the vote form
  function preselectOptionInForm(optText) {
    if (!voteFormSection) return;

    // Check if checkbox exists and toggle it on
    if (voterCheckboxList) {
      const targetCard = voterCheckboxList.querySelector(`[data-option="${CSS.escape(optText)}"]`);
      if (targetCard && !targetCard.classList.contains('selected')) {
        targetCard.classList.add('selected');
        const checkInd = targetCard.querySelector('.custom-checkbox-indicator');
        if (checkInd) checkInd.textContent = '✓';
      }
    }

    // Scroll form into view and focus name input
    voteFormSection.scrollIntoView({ behavior: 'smooth', block: 'center' });
    if (voterNameInput) {
      setTimeout(() => voterNameInput.focus(), 250);
    }
  }

  // Toggle vote form focus
  if (btnToggleVoteForm) {
    btnToggleVoteForm.addEventListener('click', () => {
      if (voteFormSection) {
        voteFormSection.scrollIntoView({ behavior: 'smooth', block: 'center' });
        if (voterNameInput) setTimeout(() => voterNameInput.focus(), 250);
      }
    });
  }

  /* ------------------- Handle Vote Submission ------------------- */
  if (btnSubmitVote) {
    btnSubmitVote.addEventListener('click', () => {
      if (!currentViewingActivityId) return;

      const act = activities.find(a => a.id === currentViewingActivityId);
      if (!act) return;

      // Validate deadline
      const now = new Date();
      const dDate = new Date(act.deadline);
      if (!isNaN(dDate.getTime()) && dDate <= now) {
        showVoteFeedback('warning', '🔒 本活動選擇已截止，無法再送出選擇。');
        showToast('本活動選擇已截止');
        return;
      }

      const voterName = voterNameInput ? voterNameInput.value.trim() : '';

      // Validate Name
      if (!voterName) {
        showVoteFeedback('error', '⚠️ 請輸入你的姓名！');
        if (voterNameInput) voterNameInput.focus();
        return;
      }

      // Check which options are checked
      const selectedCards = voterCheckboxList ? voterCheckboxList.querySelectorAll('.voter-checkbox-card.selected') : [];
      if (selectedCards.length === 0) {
        showVoteFeedback('error', '⚠️ 請至少勾選 1 個你想參加的項目！');
        return;
      }

      const selectedOptions = Array.from(selectedCards).map(card => card.getAttribute('data-option'));

      // Check if user has already voted for this activity (Prevent Duplicates)
      const hasVoted = selections.some(s => 
        s.activityId === currentViewingActivityId && 
        s.userName.trim().toLowerCase() === voterName.toLowerCase()
      );

      if (hasVoted) {
        showVoteFeedback('warning', `⚠️ 你已經完成選擇。`);
        showToast(`你已經完成選擇。`);
        return;
      }

      // Add new selection records
      const nowIso = new Date().toISOString();
      const newlyAddedVotes = [];
      selectedOptions.forEach(opt => {
        const voteItem = {
          id: 'sel_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5),
          activityId: currentViewingActivityId,
          optionId: opt,
          userName: voterName,
          createdAt: nowIso
        };
        selections.push(voteItem);
        newlyAddedVotes.push(voteItem);
      });

      // Save to localStorage
      saveSelections(selections);

      // 同步寫入雲端資料庫
      syncNewSelectionsToCloud(newlyAddedVotes);

      // Show success message: ✅ 選擇完成！ 小明已完成選擇。
      showVoteFeedback('success', `✅ 選擇完成！<br><strong>${escapeHTML(voterName)}</strong> 已完成選擇。`);
      showToast(`✅ 選擇完成！${voterName} 已完成選擇。`);

      // Refresh real-time options and voter names
      renderDetailOptionsAndVoters(act);

      // If user provided a name and currentChatUser is default or empty, adopt it
      if (voterName && (!localStorage.getItem(STORAGE_KEY_CHAT_USER) || currentChatUser === '冠宏')) {
        currentChatUser = voterName;
        saveChatUser(currentChatUser);
        if (currentChatUserDisplay) {
          currentChatUserDisplay.textContent = currentChatUser;
        }
        renderActivityChat(act.id);
      }

      // Refresh home page activity cards as well
      renderGatheringCards();

      // Clear selection inputs after brief delay
      setTimeout(() => {
        if (voterNameInput) voterNameInput.value = '';
        if (voterCheckboxList) {
          const cards = voterCheckboxList.querySelectorAll('.voter-checkbox-card');
          cards.forEach(c => {
            c.classList.remove('selected');
            const ind = c.querySelector('.custom-checkbox-indicator');
            if (ind) ind.textContent = '';
          });
        }
      }, 2500);
    });
  }

  function showVoteFeedback(type, message) {
    if (!voteFeedbackMsg) return;
    voteFeedbackMsg.className = `vote-feedback ${type}`;
    voteFeedbackMsg.innerHTML = message;
    voteFeedbackMsg.style.display = 'block';
  }

  /* ------------------- Activity Chatroom Logic (💬 活動聊天室) ------------------- */
  function renderActivityChat(activityId) {
    if (!chatStreamContainer) return;

    if (currentChatUserDisplay) {
      currentChatUserDisplay.textContent = currentChatUser || '未設定';
    }

    const actMsgs = messages
      .filter(m => m.activityId === activityId)
      .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());

    if (chatMessageCountBadge) {
      chatMessageCountBadge.textContent = `${actMsgs.length} 則訊息`;
    }

    chatStreamContainer.innerHTML = '';

    if (actMsgs.length === 0) {
      chatStreamContainer.innerHTML = `
        <div class="chat-empty-state">
          <span class="chat-empty-icon">💬</span>
          <p>目前活動中尚無聊天發言<br><span style="font-size: 0.8rem; color: var(--gold-light);">成為第一個在活動裡發言的朋友吧！</span></p>
        </div>
      `;
      return;
    }

    actMsgs.forEach(msg => {
      const isSelf = Boolean(currentChatUser && msg.userName.trim().toLowerCase() === currentChatUser.trim().toLowerCase());
      const row = document.createElement('div');
      row.className = `chat-msg-row ${isSelf ? 'self' : 'other'}`;

      const avatarChar = escapeHTML((msg.userName || '?').trim().charAt(0) || '?');
      const timeStr = formatChatTime(msg.createdAt);
      const fullTimeStr = formatDateTime(msg.createdAt);

      if (isSelf) {
        // 自己的訊息：靠右
        row.innerHTML = `
          <div class="chat-msg-meta">
            <span class="chat-msg-sender">${escapeHTML(msg.userName)}</span>
            <div class="chat-msg-avatar" title="${escapeHTML(msg.userName)}">${avatarChar}</div>
          </div>
          <div class="chat-msg-bubble">${escapeHTML(msg.message)}</div>
          <div class="chat-msg-footer">
            <span class="chat-msg-time" title="${escapeHTML(fullTimeStr)}">${timeStr}</span>
          </div>
        `;
      } else {
        // 其他人的訊息：靠左
        row.innerHTML = `
          <div class="chat-msg-meta">
            <div class="chat-msg-avatar" title="${escapeHTML(msg.userName)}">${avatarChar}</div>
            <span class="chat-msg-sender">${escapeHTML(msg.userName)}</span>
          </div>
          <div class="chat-msg-bubble">${escapeHTML(msg.message)}</div>
          <div class="chat-msg-footer">
            <span class="chat-msg-time" title="${escapeHTML(fullTimeStr)}">${timeStr}</span>
          </div>
        `;
      }

      chatStreamContainer.appendChild(row);
    });

    // Auto scroll chat to bottom
    chatStreamContainer.scrollTop = chatStreamContainer.scrollHeight;
  }

  function sendCurrentChatMessage() {
    if (!currentViewingActivityId) return;

    // Check if user has set a name
    if (!currentChatUser || !currentChatUser.trim()) {
      openChatNameModal();
      return;
    }

    const text = chatTextInput ? chatTextInput.value.trim() : '';

    // Prevent empty / whitespace messages
    if (!text) {
      showToast('⚠️ 請輸入聊天訊息，不能發送空白內容');
      if (chatTextInput) chatTextInput.focus();
      return;
    }

    const newMsg = {
      id: 'msg_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6),
      activityId: currentViewingActivityId,
      userName: currentChatUser.trim(),
      message: text,
      createdAt: new Date().toISOString()
    };

    messages.push(newMsg);
    saveMessages(messages);

    if (chatTextInput) {
      chatTextInput.value = '';
    }

    renderActivityChat(currentViewingActivityId);

    // Scroll to bottom smoothly
    setTimeout(() => {
      if (chatStreamContainer) {
        chatStreamContainer.scrollTop = chatStreamContainer.scrollHeight;
      }
    }, 40);
  }

  // Chat Identity Modal Handlers
  function openChatNameModal() {
    if (!chatNameModal) return;
    if (chatUserNameInput) {
      chatUserNameInput.value = currentChatUser || '';
    }
    chatNameModal.classList.add('open');
    chatNameModal.setAttribute('aria-hidden', 'false');
    setTimeout(() => {
      if (chatUserNameInput) chatUserNameInput.focus();
    }, 150);
  }

  function closeChatNameModal() {
    if (!chatNameModal) return;
    chatNameModal.classList.remove('open');
    chatNameModal.setAttribute('aria-hidden', 'true');
  }

  function handleConfirmChatName() {
    if (!chatUserNameInput) return;
    const newName = chatUserNameInput.value.trim();
    if (!newName) {
      showToast('⚠️ 請輸入你的姓名！');
      chatUserNameInput.focus();
      return;
    }

    currentChatUser = newName;
    saveChatUser(currentChatUser);
    closeChatNameModal();
    showToast(`✨ 聊天發言身份已設定為「${currentChatUser}」`);

    if (currentChatUserDisplay) {
      currentChatUserDisplay.textContent = currentChatUser;
    }

    if (currentViewingActivityId) {
      renderActivityChat(currentViewingActivityId);
    }

    if (chatTextInput) {
      chatTextInput.focus();
    }
  }

  // Bind Chat Event Listeners
  if (btnSwitchChatIdentity) {
    btnSwitchChatIdentity.addEventListener('click', openChatNameModal);
  }

  if (btnCloseChatNameModal) {
    btnCloseChatNameModal.addEventListener('click', closeChatNameModal);
  }

  if (btnCancelChatName) {
    btnCancelChatName.addEventListener('click', closeChatNameModal);
  }

  if (chatNameModal) {
    chatNameModal.addEventListener('click', (e) => {
      if (e.target === chatNameModal) closeChatNameModal();
    });
  }

  if (chatNameForm) {
    chatNameForm.addEventListener('submit', (e) => {
      e.preventDefault();
      handleConfirmChatName();
    });
  }

  if (btnConfirmChatName) {
    btnConfirmChatName.addEventListener('click', (e) => {
      e.preventDefault();
      handleConfirmChatName();
    });
  }

  if (btnSendMessage) {
    btnSendMessage.addEventListener('click', (e) => {
      e.preventDefault();
      sendCurrentChatMessage();
    });
  }

  if (chatInputForm) {
    chatInputForm.addEventListener('submit', (e) => {
      e.preventDefault();
      sendCurrentChatMessage();
    });
  }

  if (chatTextInput) {
    chatTextInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        sendCurrentChatMessage();
      }
    });
  }

  /* ------------------- Activity Memories & Photos Logic (📸 活動回憶) ------------------- */
  const photoFileInput = document.getElementById('photoFileInput');
  const photosCountBadge = document.getElementById('photosCountBadge');
  const photosGalleryGrid = document.getElementById('photosGalleryGrid');
  const photosEmptyState = document.getElementById('photosEmptyState');
  const photosHeaderActions = document.getElementById('photosHeaderActions');
  const photosSectionDesc = document.getElementById('photosSectionDesc');

  // Lightbox Elements
  const photoLightboxModal = document.getElementById('photoLightboxModal');
  const lightboxImg = document.getElementById('lightboxImg');
  const lightboxIndex = document.getElementById('lightboxIndex');
  const lightboxCaption = document.getElementById('lightboxCaption');
  const btnLightboxPrev = document.getElementById('btnLightboxPrev');
  const btnLightboxNext = document.getElementById('btnLightboxNext');
  const btnCloseLightbox = document.getElementById('btnCloseLightbox');
  const lightboxBackdrop = document.getElementById('lightboxBackdrop');
  const btnDownloadCurrentPhoto = document.getElementById('btnDownloadCurrentPhoto');

  let currentLightboxPhotos = [];
  let currentLightboxIndex = 0;

  function renderActivityPhotos(activityId, isExpired) {
    if (!photosGalleryGrid) return;

    const actPhotos = photos.filter(p => p.activityId === activityId);

    if (photosCountBadge) {
      photosCountBadge.textContent = `${actPhotos.length} 張照片`;
    }

    if (photosSectionDesc) {
      photosSectionDesc.textContent = isExpired
        ? '活動結束後的美好回憶封存，可隨時上傳與下載朋友間的精彩照片'
        : '聚會精彩瞬間，活動進行中亦可提前上傳花絮或下載珍藏照片';
    }

    photosGalleryGrid.innerHTML = '';

    if (actPhotos.length === 0) {
      if (photosEmptyState) photosEmptyState.style.display = 'block';
      return;
    }

    if (photosEmptyState) photosEmptyState.style.display = 'none';

    actPhotos.forEach((photo, idx) => {
      const card = document.createElement('div');
      card.className = 'photo-gallery-card';
      card.setAttribute('data-index', idx);
      card.setAttribute('title', '點擊開啟大圖檢視與下載');

      card.innerHTML = `
        <img src="${photo.url}" alt="${escapeHTML(photo.caption || '活動照片')}" class="photo-card-img" loading="lazy">
        <div class="photo-card-overlay">
          <span class="photo-card-caption">${escapeHTML(photo.caption || '精彩瞬間')}</span>
          <button type="button" class="photo-card-quick-download" title="下載此照片" data-index="${idx}">📥</button>
        </div>
      `;

      card.addEventListener('click', (e) => {
        if (e.target.closest('.photo-card-quick-download')) {
          e.stopPropagation();
          downloadPhoto(photo.url, `${photo.caption || 'activity_memory'}.jpg`);
          return;
        }
        openLightbox(actPhotos, idx);
      });

      photosGalleryGrid.appendChild(card);
    });
  }

  // Handle Multi-file Upload (JPG, PNG, WEBP)
  if (photoFileInput) {
    photoFileInput.addEventListener('change', async (e) => {
      const files = Array.from(e.target.files);
      if (!files || files.length === 0 || !currentViewingActivityId) return;

      const validFiles = files.filter(f => ['image/jpeg', 'image/png', 'image/webp'].includes(f.type));
      if (validFiles.length === 0) {
        showToast('⚠️ 僅支援 JPG、PNG、WEBP 格式照片');
        photoFileInput.value = '';
        return;
      }

      showToast(`⏳ 正在上傳與最佳化 ${validFiles.length} 張照片...`);

      let count = 0;
      for (const file of validFiles) {
        try {
          const dataUrl = await readFileAndCompress(file);
          const newPhoto = {
            id: 'photo_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6),
            activityId: currentViewingActivityId,
            caption: file.name.replace(/\.[^/.]+$/, ''),
            url: dataUrl,
            uploadedAt: new Date().toISOString()
          };
          photos.push(newPhoto);
          count++;
        } catch (err) {
          console.error('Photo processing error:', err);
        }
      }

      savePhotos(photos);
      photoFileInput.value = '';

      const act = activities.find(a => a.id === currentViewingActivityId);
      const now = new Date();
      const isExpired = act && !isNaN(new Date(act.deadline).getTime()) && new Date(act.deadline) <= now;

      renderActivityPhotos(currentViewingActivityId, isExpired);
      renderGatheringCards();

      showToast(`📸 成功上傳 ${count} 張活動回憶照片！`);
    });
  }

  // Lightbox Functions
  function openLightbox(photosList, index = 0) {
    if (!photoLightboxModal || !photosList || photosList.length === 0) return;

    currentLightboxPhotos = photosList;
    currentLightboxIndex = index;
    updateLightboxUI();

    photoLightboxModal.classList.add('open');
    photoLightboxModal.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';
  }

  function closeLightbox() {
    if (!photoLightboxModal) return;
    photoLightboxModal.classList.remove('open');
    photoLightboxModal.setAttribute('aria-hidden', 'true');

    if (!viewModal || !viewModal.classList.contains('open')) {
      document.body.style.overflow = '';
    }
  }

  function lightboxPrev() {
    if (currentLightboxPhotos.length === 0) return;
    currentLightboxIndex = (currentLightboxIndex - 1 + currentLightboxPhotos.length) % currentLightboxPhotos.length;
    updateLightboxUI();
  }

  function lightboxNext() {
    if (currentLightboxPhotos.length === 0) return;
    currentLightboxIndex = (currentLightboxIndex + 1) % currentLightboxPhotos.length;
    updateLightboxUI();
  }

  function updateLightboxUI() {
    if (!currentLightboxPhotos[currentLightboxIndex]) return;
    const p = currentLightboxPhotos[currentLightboxIndex];

    if (lightboxImg) lightboxImg.src = p.url;
    if (lightboxIndex) lightboxIndex.textContent = `${currentLightboxIndex + 1} / ${currentLightboxPhotos.length}`;
    if (lightboxCaption) lightboxCaption.textContent = p.caption || '活動回憶照片';
  }

  // Lightbox Listeners
  if (btnLightboxPrev) btnLightboxPrev.addEventListener('click', lightboxPrev);
  if (btnLightboxNext) btnLightboxNext.addEventListener('click', lightboxNext);
  if (btnCloseLightbox) btnCloseLightbox.addEventListener('click', closeLightbox);
  if (lightboxBackdrop) lightboxBackdrop.addEventListener('click', closeLightbox);

  if (btnDownloadCurrentPhoto) {
    btnDownloadCurrentPhoto.addEventListener('click', () => {
      if (currentLightboxPhotos[currentLightboxIndex]) {
        const p = currentLightboxPhotos[currentLightboxIndex];
        downloadPhoto(p.url, `${p.caption || 'activity_photo'}.jpg`);
      }
    });
  }

  // Mobile Touch Swipe on Lightbox
  if (photoLightboxModal) {
    let touchStartX = 0;
    let touchStartY = 0;

    photoLightboxModal.addEventListener('touchstart', (e) => {
      touchStartX = e.touches[0].clientX;
      touchStartY = e.touches[0].clientY;
    }, { passive: true });

    photoLightboxModal.addEventListener('touchend', (e) => {
      const touchEndX = e.changedTouches[0].clientX;
      const touchEndY = e.changedTouches[0].clientY;
      const diffX = touchEndX - touchStartX;
      const diffY = touchEndY - touchStartY;

      if (Math.abs(diffX) > 40 && Math.abs(diffX) > Math.abs(diffY)) {
        if (diffX < 0) {
          lightboxNext();
        } else {
          lightboxPrev();
        }
      }
    }, { passive: true });
  }

  function closeViewModal() {
    if (!viewModal) return;
    viewModal.classList.remove('open');
    viewModal.setAttribute('aria-hidden', 'true');
    document.body.style.overflow = '';
    currentViewingActivityId = null;
  }

  if (viewModalCloseBtn) viewModalCloseBtn.addEventListener('click', closeViewModal);
  if (btnCloseViewModal) btnCloseViewModal.addEventListener('click', closeViewModal);

  if (viewModal) {
    viewModal.addEventListener('click', (e) => {
      if (e.target === viewModal) closeViewModal();
    });
  }

  // Global escape and arrow keys handler
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      if (photoLightboxModal && photoLightboxModal.classList.contains('open')) {
        closeLightbox();
        return;
      }
      if (chatNameModal && chatNameModal.classList.contains('open')) {
        closeChatNameModal();
        return;
      }
      if (viewModal && viewModal.classList.contains('open')) closeViewModal();
      if (createModal && createModal.classList.contains('open')) closeCreateModal();
    } else if (photoLightboxModal && photoLightboxModal.classList.contains('open')) {
      if (e.key === 'ArrowLeft') {
        lightboxPrev();
      } else if (e.key === 'ArrowRight') {
        lightboxNext();
      }
    }
  });
}

/* ==========================================================================
   4. LocalStorage & Demo Data Persistence
   ========================================================================== */
function loadActivities() {
  const demoExpiredActivity = {
    id: 'demo_yl_3',
    title: '夏日宜蘭海風露營',
    creator: '冠宏',
    deadline: '2026-08-20T20:00', // Past deadline -> Archived
    cover: generateLuxurySvgCover('夏日宜蘭海風露營', '🏕️ 南澳海邊露營'),
    options: [
      '🏕️ 南澳海邊星空露營',
      '🥩 炭烤和牛營火晚會',
      '🌊 太平洋晨曦踏浪',
      '🍻 徹夜微醺星空暢聊'
    ],
    createdAt: '2026-08-10T14:00:00.000Z',
    isReadOnly: true
  };

  const defaultDemoList = [
    {
      id: 'demo_tc_1',
      title: '台中週末吃喝團',
      creator: '冠宏',
      deadline: '2026-10-30T23:59',
      cover: generateLuxurySvgCover('台中週末吃喝團', '🥩 屋馬和牛燒肉'),
      options: [
        '🥩 屋馬極上和牛燒肉',
        '☕ 審計新村散步品手沖咖啡',
        '🎤 享溫馨頂級奢華KTV',
        '🧋 逢甲夜市排隊美食掃街'
      ],
      createdAt: '2026-09-15T18:00:00.000Z',
      isReadOnly: true
    },
    {
      id: 'demo_ml_2',
      title: '苗栗一日遊',
      creator: '冠宏',
      deadline: '2026-11-15T20:00',
      cover: generateLuxurySvgCover('苗栗一日遊', '🍓 大湖採草莓'),
      options: [
        '🍓 大湖採頂級高山草莓',
        '🚂 舊山線鐵道自行車 Rail Bike',
        '🍜 苗栗客家傳統手工粄條',
        '♨️ 泰安景觀露天溫泉舒壓泡腳'
      ],
      createdAt: '2026-09-16T10:00:00.000Z',
      isReadOnly: true
    },
    demoExpiredActivity
  ];

  try {
    const raw = localStorage.getItem(STORAGE_KEY_ACTIVITIES);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        // Ensure at least one expired activity exists in list for instant test verification
        const now = new Date();
        const hasExpired = parsed.some(a => new Date(a.deadline) <= now);
        if (!hasExpired) {
          parsed.push(demoExpiredActivity);
          saveActivities(parsed);
        }
        return parsed;
      }
    }
  } catch (err) {
    console.error('Error loading activities from localStorage:', err);
  }

  saveActivities(defaultDemoList);
  return defaultDemoList;
}

function saveActivities(list) {
  try {
    localStorage.setItem(STORAGE_KEY_ACTIVITIES, JSON.stringify(list));
  } catch (err) {
    console.error('Error saving activities to localStorage:', err);
    showToast('⚠️ 儲存失敗：可能超過瀏覽器暫存容量');
  }
}

function loadSelections() {
  const demoExpiredSelections = [
    { id: 'sel_yl_1', activityId: 'demo_yl_3', optionId: '🏕️ 南澳海邊星空露營', userName: '冠宏', createdAt: '2026-08-15T18:00:00.000Z' },
    { id: 'sel_yl_2', activityId: 'demo_yl_3', optionId: '🏕️ 南澳海邊星空露營', userName: '小明', createdAt: '2026-08-15T18:10:00.000Z' },
    { id: 'sel_yl_3', activityId: 'demo_yl_3', optionId: '🏕️ 南澳海邊星空露營', userName: '阿華', createdAt: '2026-08-15T18:15:00.000Z' },
    { id: 'sel_yl_4', activityId: 'demo_yl_3', optionId: '🏕️ 南澳海邊星空露營', userName: '萱萱', createdAt: '2026-08-15T18:20:00.000Z' },
    { id: 'sel_yl_5', activityId: 'demo_yl_3', optionId: '🏕️ 南澳海邊星空露營', userName: '柏翰', createdAt: '2026-08-15T18:25:00.000Z' },
    { id: 'sel_yl_6', activityId: 'demo_yl_3', optionId: '🥩 炭烤和牛營火晚會', userName: '冠宏', createdAt: '2026-08-15T18:30:00.000Z' },
    { id: 'sel_yl_7', activityId: 'demo_yl_3', optionId: '🥩 炭烤和牛營火晚會', userName: '小明', createdAt: '2026-08-15T18:32:00.000Z' },
    { id: 'sel_yl_8', activityId: 'demo_yl_3', optionId: '🥩 炭烤和牛營火晚會', userName: '萱萱', createdAt: '2026-08-15T18:35:00.000Z' },
    { id: 'sel_yl_9', activityId: 'demo_yl_3', optionId: '🥩 炭烤和牛營火晚會', userName: '柏翰', createdAt: '2026-08-15T18:40:00.000Z' },
    { id: 'sel_yl_10', activityId: 'demo_yl_3', optionId: '🌊 太平洋晨曦踏浪', userName: '冠宏', createdAt: '2026-08-15T18:45:00.000Z' },
    { id: 'sel_yl_11', activityId: 'demo_yl_3', optionId: '🌊 太平洋晨曦踏浪', userName: '阿華', createdAt: '2026-08-15T18:50:00.000Z' },
    { id: 'sel_yl_12', activityId: 'demo_yl_3', optionId: '🌊 太平洋晨曦踏浪', userName: '柏翰', createdAt: '2026-08-15T18:55:00.000Z' },
    { id: 'sel_yl_13', activityId: 'demo_yl_3', optionId: '🍻 徹夜微醺星空暢聊', userName: '冠宏', createdAt: '2026-08-15T19:00:00.000Z' },
    { id: 'sel_yl_14', activityId: 'demo_yl_3', optionId: '🍻 徹夜微醺星空暢聊', userName: '小明', createdAt: '2026-08-15T19:05:00.000Z' },
    { id: 'sel_yl_15', activityId: 'demo_yl_3', optionId: '🍻 徹夜微醺星空暢聊', userName: '阿華', createdAt: '2026-08-15T19:10:00.000Z' },
    { id: 'sel_yl_16', activityId: 'demo_yl_3', optionId: '🍻 徹夜微醺星空暢聊', userName: '萱萱', createdAt: '2026-08-15T19:15:00.000Z' }
  ];

  try {
    const raw = localStorage.getItem(STORAGE_KEY_SELECTIONS);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        // Ensure demo_yl_3 selections exist
        const hasYlSelections = parsed.some(s => s.activityId === 'demo_yl_3');
        if (!hasYlSelections) {
          parsed.push(...demoExpiredSelections);
          saveSelections(parsed);
        }
        return parsed;
      }
    }
  } catch (err) {
    console.error('Error loading selections from localStorage:', err);
  }

  // Initial demo selections
  const demoSelections = [
    // 台中週末吃喝團
    { id: 'sel_demo_1', activityId: 'demo_tc_1', optionId: '🥩 屋馬極上和牛燒肉', userName: '冠宏', createdAt: '2026-09-15T19:00:00.000Z' },
    { id: 'sel_demo_2', activityId: 'demo_tc_1', optionId: '🥩 屋馬極上和牛燒肉', userName: '小明', createdAt: '2026-09-15T19:10:00.000Z' },
    { id: 'sel_demo_3', activityId: 'demo_tc_1', optionId: '🥩 屋馬極上和牛燒肉', userName: '阿華', createdAt: '2026-09-15T19:15:00.000Z' },
    { id: 'sel_demo_4', activityId: 'demo_tc_1', optionId: '☕ 審計新村散步品手沖咖啡', userName: '萱萱', createdAt: '2026-09-15T19:20:00.000Z' },
    { id: 'sel_demo_5', activityId: 'demo_tc_1', optionId: '☕ 審計新村散步品手沖咖啡', userName: '小宇', createdAt: '2026-09-15T19:22:00.000Z' },
    { id: 'sel_demo_6', activityId: 'demo_tc_1', optionId: '🎤 享溫馨頂級奢華KTV', userName: '小美', createdAt: '2026-09-15T19:30:00.000Z' },
    { id: 'sel_demo_7', activityId: 'demo_tc_1', optionId: '🎤 享溫馨頂級奢華KTV', userName: '阿偉', createdAt: '2026-09-15T19:35:00.000Z' },
    { id: 'sel_demo_8', activityId: 'demo_tc_1', optionId: '🧋 逢甲夜市排隊美食掃街', userName: '冠宏', createdAt: '2026-09-15T19:40:00.000Z' },
    { id: 'sel_demo_9', activityId: 'demo_tc_1', optionId: '🧋 逢甲夜市排隊美食掃街', userName: '志豪', createdAt: '2026-09-15T19:45:00.000Z' },

    // 苗栗一日遊
    { id: 'sel_demo_10', activityId: 'demo_ml_2', optionId: '🍓 大湖採頂級高山草莓', userName: '冠宏', createdAt: '2026-09-16T11:00:00.000Z' },
    { id: 'sel_demo_11', activityId: 'demo_ml_2', optionId: '🍓 大湖採頂級高山草莓', userName: '雅婷', createdAt: '2026-09-16T11:05:00.000Z' },
    { id: 'sel_demo_12', activityId: 'demo_ml_2', optionId: '🍓 大湖採頂級高山草莓', userName: '柏翰', createdAt: '2026-09-16T11:10:00.000Z' },
    { id: 'sel_demo_13', activityId: 'demo_ml_2', optionId: '🚂 舊山線鐵道自行車 Rail Bike', userName: '冠宏', createdAt: '2026-09-16T11:15:00.000Z' },
    { id: 'sel_demo_14', activityId: 'demo_ml_2', optionId: '🚂 舊山線鐵道自行車 Rail Bike', userName: '柏翰', createdAt: '2026-09-16T11:20:00.000Z' },
    { id: 'sel_demo_15', activityId: 'demo_ml_2', optionId: '♨️ 泰安景泡露天溫泉舒壓泡腳', userName: '雅婷', createdAt: '2026-09-16T11:25:00.000Z' },
    { id: 'sel_demo_16', activityId: 'demo_ml_2', optionId: '♨️ 泰安景觀露天溫泉舒壓泡腳', userName: '冠宏', createdAt: '2026-09-16T11:30:00.000Z' },

    // 宜蘭海風露營（已截止回憶紀錄）
    ...demoExpiredSelections
  ];

  saveSelections(demoSelections);
  return demoSelections;
}

function saveSelections(list) {
  try {
    localStorage.setItem(STORAGE_KEY_SELECTIONS, JSON.stringify(list));
  } catch (err) {
    console.error('Error saving selections to localStorage:', err);
    showToast('⚠️ 投票資料儲存失敗：可能超過容量');
  }
}

/* ------------------- Chat Messages & User Persistence ------------------- */
function loadMessages() {
  const defaultDemoMessages = [
    {
      id: 'msg_demo_1',
      activityId: 'demo_tc_1',
      userName: '冠宏',
      message: '大家週六有空嗎？',
      createdAt: '2026-09-16T21:35:00.000Z'
    },
    {
      id: 'msg_demo_2',
      activityId: 'demo_tc_1',
      userName: '小明',
      message: '我可以！',
      createdAt: '2026-09-16T21:36:00.000Z'
    },
    {
      id: 'msg_demo_3',
      activityId: 'demo_tc_1',
      userName: '萱萱',
      message: '我也加一，想吃屋馬燒肉！😋',
      createdAt: '2026-09-16T21:38:00.000Z'
    },
    {
      id: 'msg_demo_4',
      activityId: 'demo_yl_3',
      userName: '冠宏',
      message: '這次海風露營大家裝備都有準備齊全嗎？',
      createdAt: '2026-08-18T19:30:00.000Z'
    },
    {
      id: 'msg_demo_5',
      activityId: 'demo_yl_3',
      userName: '阿偉',
      message: '和牛跟炭火我都訂好了，期待營火晚會！🔥',
      createdAt: '2026-08-18T19:35:00.000Z'
    }
  ];

  try {
    const raw = localStorage.getItem(STORAGE_KEY_MESSAGES);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed;
      }
    }
  } catch (err) {
    console.error('Error loading messages from localStorage:', err);
  }

  saveMessages(defaultDemoMessages);
  return defaultDemoMessages;
}

function saveMessages(list) {
  try {
    localStorage.setItem(STORAGE_KEY_MESSAGES, JSON.stringify(list));
  } catch (err) {
    console.error('Error saving messages to localStorage:', err);
    showToast('⚠️ 聊天訊息儲存失敗：可能超過容量');
  }
}

function loadChatUser() {
  try {
    const stored = localStorage.getItem(STORAGE_KEY_CHAT_USER);
    if (stored && stored.trim()) {
      return stored.trim();
    }
  } catch (e) {
    // ignore
  }
  return '冠宏'; // Default sender name
}

function saveChatUser(userName) {
  try {
    localStorage.setItem(STORAGE_KEY_CHAT_USER, userName);
  } catch (e) {
    console.error('Error saving chat user:', e);
  }
}

function formatChatTime(dateTimeStr) {
  if (!dateTimeStr) return '';
  try {
    const d = new Date(dateTimeStr);
    if (isNaN(d.getTime())) return dateTimeStr;
    const hours = String(d.getHours()).padStart(2, '0');
    const mins = String(d.getMinutes()).padStart(2, '0');
    return `${hours}:${mins}`;
  } catch (e) {
    return '';
  }
}

/* ------------------- Activity Memories & Photos Persistence (📸 活動回憶) ------------------- */
function generateLuxuryMemoryPhotoSvg(title, subtitle, icon = '📸', themeColor = '#D4AF37') {
  const safeTitle = escapeXML(title);
  const safeSub = escapeXML(subtitle || 'MEMORIES');
  const safeIcon = escapeXML(icon);

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 600" width="800" height="600">
    <defs>
      <linearGradient id="bgGrad" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="#141824"/>
        <stop offset="50%" stop-color="#0B0D14"/>
        <stop offset="100%" stop-color="#050608"/>
      </linearGradient>
      <linearGradient id="goldText" x1="0%" y1="0%" x2="100%" y2="0%">
        <stop offset="0%" stop-color="#FCE79D"/>
        <stop offset="50%" stop-color="${themeColor}"/>
        <stop offset="100%" stop-color="#AA7C11"/>
      </linearGradient>
      <radialGradient id="glow" cx="50%" cy="40%" r="50%">
        <stop offset="0%" stop-color="${themeColor}" stop-opacity="0.3"/>
        <stop offset="100%" stop-color="#000000" stop-opacity="0"/>
      </radialGradient>
      <pattern id="dotGrid" width="30" height="30" patternUnits="userSpaceOnUse">
        <circle cx="15" cy="15" r="1" fill="rgba(212,175,55,0.12)"/>
      </pattern>
    </defs>

    <rect width="800" height="600" fill="url(#bgGrad)"/>
    <rect width="800" height="600" fill="url(#dotGrid)"/>
    <circle cx="400" cy="260" r="260" fill="url(#glow)"/>

    <!-- Decorative Border -->
    <rect x="25" y="25" width="750" height="550" rx="16" fill="none" stroke="rgba(212,175,55,0.25)" stroke-width="1.5"/>
    <rect x="35" y="35" width="730" height="530" rx="12" fill="none" stroke="rgba(255,255,255,0.06)" stroke-width="1"/>

    <!-- Central Icon Circle -->
    <circle cx="400" cy="220" r="64" fill="rgba(212,175,55,0.1)" stroke="url(#goldText)" stroke-width="2"/>
    <text x="400" y="240" font-size="52" text-anchor="middle" font-family="'Segoe UI Emoji', sans-serif">${safeIcon}</text>

    <!-- Title & Subtitle -->
    <text x="400" y="350" fill="url(#goldText)" font-size="34" font-weight="700" font-family="'Outfit','Noto Sans TC',sans-serif" text-anchor="middle" letter-spacing="1.5">${safeTitle}</text>
    <text x="400" y="395" fill="#A1A7B8" font-size="17" font-weight="500" font-family="'Outfit','Noto Sans TC',sans-serif" text-anchor="middle" letter-spacing="2.5">${safeSub}</text>

    <!-- Bottom Badge -->
    <text x="400" y="510" fill="rgba(212,175,55,0.6)" font-size="12" font-family="'Outfit',sans-serif" text-anchor="middle" letter-spacing="4">LAI GUAN HONG · EXCLUSIVE MEMORY ARCHIVE</text>
  </svg>`;

  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

function loadPhotos() {
  const defaultPhotos = [
    {
      id: 'p_demo_yl_1',
      activityId: 'demo_yl_3',
      caption: '🏕️ 南澳海邊星空營地',
      url: generateLuxuryMemoryPhotoSvg('南澳海邊星空營地', '🏕️ 太平洋微風與繁星點綴', '🏕️'),
      uploadedAt: '2026-08-20T21:00:00.000Z'
    },
    {
      id: 'p_demo_yl_2',
      activityId: 'demo_yl_3',
      caption: '🥩 極上炭烤和牛晚會',
      url: generateLuxuryMemoryPhotoSvg('極上炭烤和牛晚會', '🥩 營火微醺與頂級美食', '🥩'),
      uploadedAt: '2026-08-20T21:15:00.000Z'
    },
    {
      id: 'p_demo_yl_3',
      activityId: 'demo_yl_3',
      caption: '🌊 太平洋晨曦踏浪時光',
      url: generateLuxuryMemoryPhotoSvg('太平洋晨曦踏浪', '🌊 晨光灑落浪花的美好瞬間', '🌊'),
      uploadedAt: '2026-08-21T06:30:00.000Z'
    },
    {
      id: 'p_demo_yl_4',
      activityId: 'demo_yl_3',
      caption: '🍻 營火微醺星空暢聊',
      url: generateLuxuryMemoryPhotoSvg('營火微醺暢聊', '🍻 兄弟好友深夜交心時光', '🍻'),
      uploadedAt: '2026-08-20T23:45:00.000Z'
    },
    {
      id: 'p_demo_yl_5',
      activityId: 'demo_yl_3',
      caption: '☕ 晨光野營手沖香醇咖啡',
      url: generateLuxuryMemoryPhotoSvg('晨光手沖咖啡', '☕ 喚醒海風早晨的頂級風味', '☕'),
      uploadedAt: '2026-08-21T07:15:00.000Z'
    },
    {
      id: 'p_demo_yl_6',
      activityId: 'demo_yl_3',
      caption: '🌌 銀河星空好友大合照',
      url: generateLuxuryMemoryPhotoSvg('銀河星空大合照', '🌌 難忘回憶·友情無價', '🌌'),
      uploadedAt: '2026-08-20T22:30:00.000Z'
    }
  ];

  try {
    const raw = localStorage.getItem(STORAGE_KEY_PHOTOS);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed;
      }
    }
  } catch (err) {
    console.error('Error loading photos from localStorage:', err);
  }

  savePhotos(defaultPhotos);
  return defaultPhotos;
}

function savePhotos(list) {
  try {
    localStorage.setItem(STORAGE_KEY_PHOTOS, JSON.stringify(list));
  } catch (err) {
    console.error('Error saving photos to localStorage:', err);
    showToast('⚠️ 相簿儲存容量受限，建議挑選精彩照片上傳');
  }
}

function downloadPhoto(url, filename = 'activity_photo.jpg') {
  try {
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast('📥 照片已開始下載！');
  } catch (e) {
    console.error('Download error:', e);
    showToast('⚠️ 照片下載失敗，請重試');
  }
}

function readFileAndCompress(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const maxW = 1280;
        let w = img.width;
        let h = img.height;
        if (w > maxW) {
          h = Math.round((h * maxW) / w);
          w = maxW;
        }
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, w, h);
        resolve(canvas.toDataURL('image/jpeg', 0.82));
      };
      img.onerror = () => resolve(e.target.result);
      img.src = e.target.result;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

/* ==========================================================================
   5. Dynamic SVG Luxury Cover Generator (Default Fallback)
   ========================================================================== */
function generateLuxurySvgCover(title, subtitle) {
  const safeTitle = escapeXML(title);
  const safeSub = escapeXML(subtitle || 'PRIVATE GATHERING');

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 450" width="800" height="450">
    <defs>
      <linearGradient id="bgGrad" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="#141722"/>
        <stop offset="50%" stop-color="#0B0D13"/>
        <stop offset="100%" stop-color="#060709"/>
      </linearGradient>
      <linearGradient id="goldText" x1="0%" y1="0%" x2="100%" y2="0%">
        <stop offset="0%" stop-color="#FCE79D"/>
        <stop offset="50%" stop-color="#D4AF37"/>
        <stop offset="100%" stop-color="#AA7C11"/>
      </linearGradient>
      <radialGradient id="goldGlow" cx="50%" cy="50%" r="50%">
        <stop offset="0%" stop-color="#D4AF37" stop-opacity="0.25"/>
        <stop offset="100%" stop-color="#000000" stop-opacity="0"/>
      </radialGradient>
      <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
        <path d="M 40 0 L 0 0 0 40" fill="none" stroke="rgba(212,175,55,0.06)" stroke-width="1"/>
      </pattern>
    </defs>

    <rect width="800" height="450" fill="url(#bgGrad)"/>
    <rect width="800" height="450" fill="url(#grid)"/>
    <circle cx="400" cy="225" r="280" fill="url(#goldGlow)"/>

    <!-- Geometric border frame -->
    <rect x="25" y="25" width="750" height="400" rx="14" fill="none" stroke="rgba(212,175,55,0.22)" stroke-width="1"/>
    <rect x="35" y="35" width="730" height="380" rx="10" fill="none" stroke="rgba(255,255,255,0.05)" stroke-width="1"/>

    <!-- Crown Monogram Symbol -->
    <path d="M 370 140 L 400 115 L 430 140 L 420 155 L 380 155 Z" fill="url(#goldText)"/>
    <circle cx="400" cy="115" r="3" fill="#FCE79D"/>

    <!-- Title & Subtitle -->
    <text x="400" y="235" fill="url(#goldText)" font-size="34" font-weight="700" font-family="'Outfit','Noto Sans TC',sans-serif" text-anchor="middle" letter-spacing="1.5">${safeTitle}</text>
    <text x="400" y="275" fill="#A1A7B8" font-size="16" font-weight="500" font-family="'Outfit','Noto Sans TC',sans-serif" text-anchor="middle" letter-spacing="3">${safeSub}</text>

    <!-- Bottom Badge -->
    <text x="400" y="360" fill="rgba(212,175,55,0.6)" font-size="12" font-family="'Outfit',sans-serif" text-anchor="middle" letter-spacing="4">LAI GUAN HONG · PRIVATE EXCLUSIVE</text>
  </svg>`;

  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

function escapeXML(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/* ==========================================================================
   6. Toast Notification System
   ========================================================================== */
let toastTimeout;
function showToast(message) {
  const toast = document.getElementById('toastNotification');
  const toastMsg = document.getElementById('toastMessage');
  if (!toast || !toastMsg) return;

  toastMsg.textContent = message;
  toast.classList.add('show');

  clearTimeout(toastTimeout);
  toastTimeout = setTimeout(() => {
    toast.classList.remove('show');
  }, 4200);
}

/* ==========================================================================
   7. Scrollspy & Navigation Active State
   ========================================================================== */
function initSmoothScrollSpy() {
  const sections = document.querySelectorAll('section[id]');
  const navLinks = document.querySelectorAll('.desktop-nav .nav-link');

  window.addEventListener('scroll', () => {
    let currentId = '';
    const scrollPos = window.scrollY + 130;

    sections.forEach(sec => {
      const top = sec.offsetTop;
      const height = sec.offsetHeight;
      if (scrollPos >= top && scrollPos < top + height) {
        currentId = sec.getAttribute('id');
      }
    });

    navLinks.forEach(link => {
      link.classList.remove('active');
      if (link.getAttribute('href') === `#${currentId}`) {
        link.classList.add('active');
      }
    });
  }, { passive: true });
}

/* ==========================================================================
   8. Helper Utilities
   ========================================================================== */
function formatDateTime(dateTimeStr) {
  if (!dateTimeStr) return '時間待討論';
  try {
    const d = new Date(dateTimeStr);
    if (isNaN(d.getTime())) return dateTimeStr;

    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    const hours = String(d.getHours()).padStart(2, '0');
    const mins = String(d.getMinutes()).padStart(2, '0');

    return `${year}/${month}/${day} ${hours}:${mins}`;
  } catch (e) {
    return dateTimeStr;
  }
}

function escapeHTML(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

/* ==========================================================================
   9. Supabase Cloud Database Manager (多人共享活動資料與即時同步)
   ========================================================================== */
const STORAGE_KEY_SUPABASE_CONFIG = 'LGH_EXCLUSIVE_SUPABASE_CONFIG_V1';

// 連線設定與實例狀態
let supabaseConfig = {
  url: '',
  anonKey: ''
};

let supabaseClient = null;
let isSupabaseReady = false;
let cloudSyncCallbacks = {
  onActivitiesSync: null,
  onSelectionsSync: null
};

// 取得 Supabase 設定（優先度：1. Netlify Functions 環境變數 -> 2. 本地儲存設定 -> 3. 程式內預設）
async function resolveSupabaseConfig() {
  // 1. 嘗試向 Netlify Function 請求後台環境變數
  try {
    const res = await fetch('/.netlify/functions/supabase-config', {
      headers: { 'Cache-Control': 'no-cache' }
    });
    if (res.ok) {
      const data = await res.json();
      if (data.supabaseUrl && data.supabaseAnonKey) {
        return {
          url: data.supabaseUrl.trim(),
          anonKey: data.supabaseAnonKey.trim(),
          source: 'Netlify 環境變數'
        };
      }
    }
  } catch (err) {
    // Netlify Function 不可用（如本地檔案開啟），接續檢查自訂設定
  }

  // 2. 檢查使用者在網頁或本機設定的 Supabase 連線資訊
  try {
    const saved = localStorage.getItem(STORAGE_KEY_SUPABASE_CONFIG);
    if (saved) {
      const parsed = JSON.parse(saved);
      if (parsed.url && parsed.anonKey) {
        return {
          url: parsed.url.trim(),
          anonKey: parsed.anonKey.trim(),
          source: '網頁自訂設定'
        };
      }
    }
  } catch (err) {
    // ignore
  }

  // 3. 檢查 window 全域注入 (若有)
  if (window.__SUPABASE_URL__ && window.__SUPABASE_ANON_KEY__) {
    return {
      url: window.__SUPABASE_URL__.trim(),
      anonKey: window.__SUPABASE_ANON_KEY__.trim(),
      source: '全域注入'
    };
  }

  return { url: '', anonKey: '', source: '未設定' };
}

// 初始化 Supabase Client 與雲端同步
async function initSupabaseCloudSync(callbacks = {}) {
  if (callbacks.onActivitiesSync) cloudSyncCallbacks.onActivitiesSync = callbacks.onActivitiesSync;
  if (callbacks.onSelectionsSync) cloudSyncCallbacks.onSelectionsSync = callbacks.onSelectionsSync;

  initCloudConfigModalUI();

  if (typeof window.supabase === 'undefined') {
    console.warn('Supabase JS SDK 尚未載入完成');
    updateCloudStatusBadge(false, 'SDK 載入中...');
    return;
  }

  const resolved = await resolveSupabaseConfig();
  supabaseConfig.url = resolved.url;
  supabaseConfig.anonKey = resolved.anonKey;

  if (!supabaseConfig.url || !supabaseConfig.anonKey) {
    console.log('ℹ️ 未檢測到 Supabase 連線金鑰，目前運行於本機快取模式。');
    updateCloudStatusBadge(false, '本機快取 (點此設定 Supabase)');
    return;
  }

  try {
    supabaseClient = window.supabase.createClient(supabaseConfig.url, supabaseConfig.anonKey, {
      auth: { persistSession: false }
    });

    // 測試連線並檢查 activities table
    const { count, error } = await supabaseClient
      .from('activities')
      .select('*', { count: 'exact', head: true });

    if (error) {
      console.warn('Supabase 連線警示 (activities 表可能尚未建立):', error.message);
      updateCloudStatusBadge(false, '連線異常: ' + error.message);
      return;
    }

    isSupabaseReady = true;
    console.log(`⚡ Supabase 雲端資料庫連線成功！來源：[${resolved.source}]`);
    updateCloudStatusBadge(true, '雲端資料庫已連線');

    // 立即從雲端同步活動與投票
    await fetchActivitiesFromCloud();
    await fetchSelectionsFromCloud();

    // 訂閱 Realtime 變更（即時跨設備同步）
    setupCloudRealtime();

    // 背景輪詢（每 10 秒自動檢查一次雲端是否有新活動或投票，確保跨設備 100% 同步）
    setInterval(async () => {
      if (document.visibilityState === 'visible' && isSupabaseReady) {
        await fetchActivitiesFromCloud();
        await fetchSelectionsFromCloud();
      }
    }, 10000);

    // 當使用者切換分頁回到網頁時，立即拉取最新活動
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible' && isSupabaseReady) {
        fetchActivitiesFromCloud();
        fetchSelectionsFromCloud();
      }
    });

  } catch (err) {
    console.error('Supabase 初始化失敗:', err);
    updateCloudStatusBadge(false, '連線錯誤: ' + err.message);
  }
}

// 從 Supabase 讀取所有最新活動
async function fetchActivitiesFromCloud() {
  if (!supabaseClient || !isSupabaseReady) return;

  try {
    const { data, error } = await supabaseClient
      .from('activities')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('讀取雲端活動失敗:', error);
      return;
    }

    if (data && data.length > 0) {
      const cloudList = data.map(row => ({
        id: row.id,
        title: row.title,
        creator: row.creator,
        cover: row.cover,
        deadline: row.deadline,
        options: Array.isArray(row.options) 
          ? row.options 
          : (typeof row.options === 'string' ? JSON.parse(row.options || '[]') : []),
        createdAt: row.created_at || row.createdAt,
        isReadOnly: row.is_read_only ?? true
      }));

      if (cloudSyncCallbacks.onActivitiesSync) {
        cloudSyncCallbacks.onActivitiesSync(cloudList);
      }
    } else if (data && data.length === 0) {
      // 雲端資料表為空時，自動將初始活動寫入雲端，讓所有人立刻看到相同的起始活動
      await seedActivitiesToCloud();
    }
  } catch (err) {
    console.error('fetchActivitiesFromCloud 例外:', err);
  }
}

// 將新建立的活動寫入 Supabase 雲端資料庫
async function syncNewActivityToCloud(newActivity) {
  if (!supabaseClient || !isSupabaseReady) {
    console.log('ℹ️ 目前尚未連線雲端資料庫，活動僅儲存在本機 localStorage。');
    return;
  }

  try {
    const { error } = await supabaseClient.from('activities').insert([{
      id: newActivity.id,
      title: newActivity.title,
      creator: newActivity.creator,
      cover: newActivity.cover,
      deadline: newActivity.deadline,
      options: newActivity.options,
      created_at: newActivity.createdAt,
      is_read_only: newActivity.isReadOnly
    }]);

    if (error) {
      console.error('活動寫入 Supabase 失敗:', error);
      showToast('⚠️ 雲端資料庫寫入警示：' + error.message);
    } else {
      console.log('✅ 活動已成功同步至 Supabase 雲端資料庫！');
      showToast(`✨「${newActivity.title}」已同步至雲端資料庫，所有好友均可看見！`);
      fetchActivitiesFromCloud();
    }
  } catch (err) {
    console.error('syncNewActivityToCloud 錯誤:', err);
  }
}

// 從 Supabase 讀取所有好友投票
async function fetchSelectionsFromCloud() {
  if (!supabaseClient || !isSupabaseReady) return;

  try {
    const { data, error } = await supabaseClient
      .from('selections')
      .select('*')
      .order('created_at', { ascending: true });

    if (error) {
      console.warn('讀取雲端投票紀錄:', error.message);
      return;
    }

    if (data && data.length > 0) {
      const cloudSelections = data.map(row => ({
        id: row.id,
        activityId: row.activity_id || row.activityId,
        optionId: row.option_id || row.optionId,
        userName: row.user_name || row.userName,
        createdAt: row.created_at || row.createdAt
      }));

      if (cloudSyncCallbacks.onSelectionsSync) {
        cloudSyncCallbacks.onSelectionsSync(cloudSelections);
      }
    }
  } catch (err) {
    console.error('fetchSelectionsFromCloud 例外:', err);
  }
}

// 將好友投票同步至 Supabase
async function syncNewSelectionsToCloud(newRows) {
  if (!supabaseClient || !isSupabaseReady) return;

  try {
    const dbRows = newRows.map(s => ({
      id: s.id,
      activity_id: s.activityId,
      option_id: s.optionId,
      user_name: s.userName,
      created_at: s.createdAt
    }));

    const { error } = await supabaseClient.from('selections').insert(dbRows);
    if (error) {
      console.warn('投票同步至雲端失敗:', error.message);
    } else {
      console.log('✅ 投票已同步至 Supabase 雲端資料庫！');
      fetchSelectionsFromCloud();
    }
  } catch (err) {
    console.error('syncNewSelectionsToCloud 例外:', err);
  }
}

// 自動播種初始資料至 Supabase
async function seedActivitiesToCloud() {
  if (!supabaseClient || !isSupabaseReady) return;
  try {
    const demoList = loadActivities();
    const rows = demoList.map(a => ({
      id: a.id,
      title: a.title,
      creator: a.creator,
      cover: a.cover,
      deadline: a.deadline,
      options: a.options,
      created_at: a.createdAt,
      is_read_only: a.isReadOnly
    }));
    await supabaseClient.from('activities').upsert(rows);
    console.log('🌱 已自動將初始示範活動同步至 Supabase 資料表！');
  } catch (e) {
    console.warn('自動播種示範資料失敗:', e);
  }
}

// 設置 Supabase Realtime 即時推播監聽
function setupCloudRealtime() {
  if (!supabaseClient) return;
  try {
    supabaseClient
      .channel('public_gatherings_sync')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'activities' }, (payload) => {
        console.log('🔔 收到活動即時更新:', payload);
        fetchActivitiesFromCloud();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'selections' }, (payload) => {
        console.log('🔔 收到投票即時更新:', payload);
        fetchSelectionsFromCloud();
      })
      .subscribe((status) => {
        console.log('📡 Supabase Realtime channel status:', status);
      });
  } catch (e) {
    console.warn('建立 Realtime 連線異常 (將由定時輪詢自動補足):', e);
  }
}

// 更新 Header 雲端連線狀態徽章
function updateCloudStatusBadge(isConnected, text) {
  const badge = document.getElementById('cloudSyncStatus');
  const label = document.getElementById('cloudSyncText');
  if (badge) {
    badge.className = `cloud-sync-status ${isConnected ? 'connected' : 'offline'}`;
  }
  if (label) {
    label.textContent = isConnected ? '🟢 雲端資料庫已連線' : `☁️ ${text || '本機模式'}`;
  }
}

// 雲端設定彈窗介面交互
function initCloudConfigModalUI() {
  const badge = document.getElementById('cloudSyncStatus');
  const modal = document.getElementById('cloudConfigModal');
  const btnClose = document.getElementById('btnCloudModalClose');
  const btnCancel = document.getElementById('btnCloudModalCancel');
  const btnSave = document.getElementById('btnSaveCloudConfig');
  const inputUrl = document.getElementById('cfgSupabaseUrl');
  const inputKey = document.getElementById('cfgSupabaseAnonKey');
  const statusDetail = document.getElementById('cloudStatusDetail');

  if (!modal) return;

  function openModal() {
    modal.classList.add('open');
    modal.setAttribute('aria-hidden', 'false');
    if (inputUrl) inputUrl.value = supabaseConfig.url || '';
    if (inputKey) inputKey.value = supabaseConfig.anonKey || '';
    if (statusDetail) {
      if (isSupabaseReady) {
        statusDetail.innerHTML = `
          <div style="color: #4ade80; font-weight: 600; margin-bottom: 6px;">✅ 雲端資料庫已成功連線</div>
          <div style="color: var(--text-muted); font-size: 0.8rem;">
            • 目標 URL: <code style="color: var(--gold-light);">${escapeHTML(supabaseConfig.url)}</code><br>
            • 目前模式: 多人共同連線同一份雲端資料庫，新增活動或投票將即時跨裝置同步！
          </div>
        `;
      } else {
        statusDetail.innerHTML = `
          <div style="color: #f59e0b; font-weight: 600; margin-bottom: 6px;">⚠️ 目前尚未連線雲端資料庫</div>
          <div style="color: var(--text-muted); font-size: 0.8rem;">
            • 目前儲存位置：瀏覽器本機 localStorage。<br>
            • 若已在 Netlify 設定環境變數，請確認變數名稱為 <code>SUPABASE_URL</code> 與 <code>SUPABASE_ANON_KEY</code>，或直接於下方填寫並儲存。
          </div>
        `;
      }
    }
  }

  function closeModal() {
    modal.classList.remove('open');
    modal.setAttribute('aria-hidden', 'true');
  }

  if (badge) badge.addEventListener('click', openModal);
  if (btnClose) btnClose.addEventListener('click', closeModal);
  if (btnCancel) btnCancel.addEventListener('click', closeModal);

  modal.addEventListener('click', (e) => {
    if (e.target === modal) closeModal();
  });

  if (btnSave) {
    btnSave.addEventListener('click', async () => {
      const url = inputUrl ? inputUrl.value.trim() : '';
      const key = inputKey ? inputKey.value.trim() : '';

      if (!url || !key) {
        showToast('⚠️ 請輸入完整的 Supabase URL 與 Anon Key');
        return;
      }

      btnSave.disabled = true;
      btnSave.textContent = '連線測試中...';

      try {
        if (typeof window.supabase === 'undefined') {
          throw new Error('Supabase SDK 尚未載入');
        }
        const testClient = window.supabase.createClient(url, key, { auth: { persistSession: false } });
        const { error } = await testClient.from('activities').select('*', { count: 'exact', head: true });

        if (error && !error.message.includes('not found')) {
          throw error;
        }

        // 儲存設定
        localStorage.setItem(STORAGE_KEY_SUPABASE_CONFIG, JSON.stringify({ url, anonKey: key }));
        supabaseConfig.url = url;
        supabaseConfig.anonKey = key;
        supabaseClient = testClient;
        isSupabaseReady = true;

        updateCloudStatusBadge(true, '雲端資料庫已連線');
        showToast('✅ 雲端資料庫連線成功！已切換為多人共享模式。');
        closeModal();

        await fetchActivitiesFromCloud();
        await fetchSelectionsFromCloud();
      } catch (err) {
        showToast(`❌ 連線失敗：${err.message}`);
        if (statusDetail) {
          statusDetail.innerHTML = `<div style="color: #ef4444;">❌ 連線失敗: ${escapeHTML(err.message)}</div>`;
        }
      } finally {
        btnSave.disabled = false;
        btnSave.textContent = '儲存並測試連線';
      }
    });
  }
}
