const homeView = document.querySelector('#accueil');
const creationView = document.querySelector('#creation');
const characteristicsView = document.querySelector('#characteristics');
const skillsView = document.querySelector('#skills');
const homeStep = document.querySelector('#home-step');
const professionStep = document.querySelector('#profession-step');
const characteristicsStep = document.querySelector('#characteristics-step');
const skillsStep = document.querySelector('#skills-step');
const professionSelect = document.querySelector('#profession-select');
const raceSelect = document.querySelector('#race-select');
const professionError = document.querySelector('#profession-error');
const raceError = document.querySelector('#race-error');
const professionDetail = document.querySelector('#profession-detail');
const emptyDetail = document.querySelector('#empty-detail');
const continueButton = document.querySelector('#continue-characteristics');
const continueSkillsButton = document.querySelector('#continue-skills');
const professionsById = new Map();
const racesById = new Map();
const characteristicsById = new Map();
const mainCharacteristicIds = new Set();
let selectedRace = null;
let characteristicsInOrder = [];
const rolls = Array(10).fill(null);
const rollAssignments = new Map();
let selectedRollIndex = null;
let potentialTable = null;
let skills = [];
let characteristicBonusRows = [];
let baseDevelopmentPoints = null;
let selectedProfessionId = '';
const acquiredSkills = new Map();
const skillSpecialValues = new Map();
const themeSelect = document.querySelector('#theme-select');

function applyTheme(theme) {
  const selectedTheme = theme === 'light' ? 'light' : 'dark';
  document.documentElement.dataset.theme = selectedTheme;
  themeSelect.value = selectedTheme;
  document.querySelector('meta[name="theme-color"]').content = selectedTheme === 'dark' ? '#111916' : '#f5f7f6';
  try {
    localStorage.setItem('rolemaster-theme', selectedTheme);
  } catch (error) {
    // The selected theme still applies for this session when storage is unavailable.
  }
}

let savedTheme = 'dark';
try {
  savedTheme = localStorage.getItem('rolemaster-theme') || 'dark';
} catch (error) {
  // Keep the default theme when storage is unavailable.
}
applyTheme(savedTheme);
themeSelect.addEventListener('change', () => applyTheme(themeSelect.value));

function showView(view) {
  const isHome = view === 'home';
  const isCreation = view === 'creation';
  const isCharacteristics = view === 'characteristics';
  const isSkills = view === 'skills';
  if (isCreation) {
    professionStep.disabled = false;
    professionStep.removeAttribute('aria-disabled');
    professionStep.title = '';
  }
  homeView.hidden = !isHome;
  creationView.hidden = !isCreation;
  characteristicsView.hidden = !isCharacteristics;
  skillsView.hidden = !isSkills;
  homeStep.classList.toggle('is-active', isHome);
  professionStep.classList.toggle('is-active', isCreation);
  characteristicsStep.classList.toggle('is-active', isCharacteristics);
  skillsStep.classList.toggle('is-active', isSkills);
  homeStep.classList.toggle('is-locked', !isHome && professionStep.disabled);
  professionStep.classList.toggle('is-locked', professionStep.disabled);
  characteristicsStep.classList.toggle('is-locked', characteristicsStep.disabled);
  skillsStep.classList.toggle('is-locked', skillsStep.disabled);
  homeStep.toggleAttribute('aria-current', isHome);
  professionStep.toggleAttribute('aria-current', isCreation);
  characteristicsStep.toggleAttribute('aria-current', isCharacteristics);
  skillsStep.toggleAttribute('aria-current', isSkills);
  document.querySelector('.nav-progress span').style.width = isHome ? '0%' : isCreation ? '33%' : isCharacteristics ? '67%' : '100%';

  if (isHome) {
    window.location.hash = 'accueil';
    document.querySelector('#new-character').focus();
  } else if (isCreation) {
    window.location.hash = 'creation';
    if (!professionSelect.disabled) professionSelect.focus();
  } else if (isCharacteristics) {
    window.location.hash = 'characteristics';
    document.querySelector('#characteristics-title').focus();
  } else {
    window.location.hash = 'skills';
    document.querySelector('#skills-title').focus();
  }
}

function updateStepAvailability() {
  const hasIdentity = Boolean(professionSelect.value && raceSelect.value);
  const allCharacteristicsAssigned = characteristicsInOrder.length === 10 && rollAssignments.size === 10;
  const canOpenSkills = hasIdentity && allCharacteristicsAssigned;
  continueButton.disabled = !hasIdentity;
  characteristicsStep.disabled = !hasIdentity;
  characteristicsStep.toggleAttribute('aria-disabled', !hasIdentity);
  characteristicsStep.title = hasIdentity ? '' : 'Choisissez d’abord une race et une profession';
  characteristicsStep.classList.toggle('is-locked', !hasIdentity);
  continueSkillsButton.disabled = !canOpenSkills;
  skillsStep.disabled = !canOpenSkills;
  skillsStep.toggleAttribute('aria-disabled', !canOpenSkills);
  skillsStep.title = canOpenSkills ? '' : 'Choisissez une race et une profession, puis attribuez les dix caractéristiques';
  skillsStep.classList.toggle('is-locked', !canOpenSkills);

  if (!hasIdentity && (!characteristicsView.hidden || !skillsView.hidden)) showView('creation');
  else if (!allCharacteristicsAssigned && !skillsView.hidden) showView('characteristics');
}

function renderProfession(profession) {
  const hasProfession = Boolean(profession);
  mainCharacteristicIds.clear();
  profession?.primeRequisites.forEach((id) => mainCharacteristicIds.add(id));
  professionDetail.hidden = !hasProfession;
  emptyDetail.hidden = hasProfession;
  renderRacePresentation();
  renderAllocation();

  if (!hasProfession) return;

  document.querySelector('#detail-name').textContent = profession.name;
  document.querySelector('#detail-realm').textContent = profession.realm.toLocaleUpperCase('fr-FR');
  document.querySelector('#detail-description').textContent = profession.description;

  const primeRequisites = document.querySelector('#prime-requisites');
  primeRequisites.replaceChildren(...profession.primeRequisites.map((characteristicId) => {
    const chip = document.createElement('span');
    chip.className = 'stat-chip';
    chip.textContent = characteristicsById.get(characteristicId).name;
    return chip;
  }));
}

function renderRacePresentation() {
  const raceFlavor = document.querySelector('#race-flavor');
  const shouldShow = Boolean(selectedRace && professionSelect.value);
  raceFlavor.hidden = !shouldShow;
  if (!shouldShow) return;

  document.querySelector('#race-detail-name').textContent = selectedRace.name;
  document.querySelector('#race-detail-description').textContent = selectedRace.description;
}

function setAllocationStatus(message) {
  document.querySelector('#allocation-status').textContent = message;
}

function createRollCards() {
  const grid = document.querySelector('#roll-grid');
  grid.replaceChildren(...rolls.map((_, index) => {
    const card = document.createElement('button');
    card.type = 'button';
    card.className = 'roll-card';
    card.dataset.rollIndex = String(index);
    card.setAttribute('aria-label', `Tirage ${index + 1} : cliquer pour lancer les dés`);
    card.innerHTML = `<span class="roll-invitation">Lancer les dés</span><span class="roll-values" hidden><span class="roll-metric roll-temporary"><span>Temp.</span><strong class="temporary-value"></strong></span><span class="roll-metric roll-potential"><span>Jet pot.</span><strong class="potential-roll-value"></strong></span><span class="roll-metric roll-potential-result"><span>Pot.</span><strong class="potential-stat-value"></strong></span></span><span class="roll-assignment"></span>`;
    card.addEventListener('click', () => {
      if (rolls[index] === null) {
        const temporary = 20 + Math.floor(Math.random() * 81);
        const potentialRoll = 1 + Math.floor(Math.random() * 100);
        rolls[index] = {
          temporary,
          potentialRoll,
          potentialValue: getPotentialValue(temporary, potentialRoll) ?? temporary
        };
        selectedRollIndex = index;
        setAllocationStatus(`Tirage ${index + 1} lancé : temporaire ${temporary}, jet de potentiel ${potentialRoll}, potentielle ${rolls[index].potentialValue ?? '—'}.`);
      } else {
        selectedRollIndex = selectedRollIndex === index ? null : index;
        setAllocationStatus(selectedRollIndex === null
          ? 'Sélection annulée.'
          : `Tirage ${index + 1} sélectionné. Choisissez une caractéristique pour l’affecter.`);
      }
      renderAllocation();
    });
    card.addEventListener('dragstart', (event) => {
      if (rolls[index] === null) {
        event.preventDefault();
        return;
      }
      event.dataTransfer.setData('text/plain', String(index));
      event.dataTransfer.effectAllowed = 'move';
      selectedRollIndex = index;
      card.classList.add('is-dragging');
      card.classList.add('is-selected');
    });
    card.addEventListener('dragend', () => card.classList.remove('is-dragging'));
    return card;
  }));

  const removeZone = document.querySelector('#roll-remove-zone');
  removeZone.addEventListener('dragover', (event) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
    removeZone.classList.add('is-drop-target');
  });
  removeZone.addEventListener('dragleave', () => removeZone.classList.remove('is-drop-target'));
  removeZone.addEventListener('drop', (event) => {
    event.preventDefault();
    removeZone.classList.remove('is-drop-target');
    const index = Number(event.dataTransfer.getData('text/plain'));
    if (Number.isInteger(index)) removeRollAssignment(index);
  });
}

function getPotentialValue(temporary, potentialRoll) {
  const statRangeIndex = potentialTable.initialStatRanges.findIndex((range) => temporary >= range.min && temporary <= range.max);
  const rollRange = potentialTable.potentialRollRanges.find((range) => potentialRoll >= range.min && potentialRoll <= range.max);
  return statRangeIndex < 0 || !rollRange ? null : rollRange.values[statRangeIndex];
}

function getAssignedValues(rollIndex, characteristicId) {
  const roll = rolls[rollIndex];
  let temporary = roll.temporary;
  if (mainCharacteristicIds.has(characteristicId) && temporary < 90) temporary = 90;
  const potential = temporary === roll.temporary
    ? roll.potentialValue
    : getPotentialValue(temporary, roll.potentialRoll) ?? temporary;
  return { temporary, potential };
}

function removeRollAssignment(rollIndex) {
  const characteristicId = [...rollAssignments.entries()].find(([, assignedIndex]) => assignedIndex === rollIndex)?.[0];
  if (!characteristicId) return;
  rollAssignments.delete(characteristicId);
  selectedRollIndex = null;
  setAllocationStatus(`Tirage retiré de ${characteristicsById.get(characteristicId).name}. Ses valeurs initiales sont rétablies.`);
  renderAllocation();
}

function createCharacteristicCards(characteristics) {
  const grid = document.querySelector('#characteristic-grid');
  grid.replaceChildren(...characteristics.map((characteristic) => {
    const card = document.createElement('button');
    card.type = 'button';
    card.className = 'characteristic-card';
    card.dataset.characteristicId = characteristic.id;
    card.setAttribute('aria-label', `${characteristic.name} : aucune valeur attribuée`);
    card.innerHTML = `<span class="characteristic-code">${characteristic.id}</span><span class="characteristic-copy"><span class="characteristic-name"></span><span class="characteristic-assigned"><span class="characteristic-temporary">—</span><span class="score-separator">/</span><span class="characteristic-potential">—</span></span></span>`;
    card.querySelector('.characteristic-name').textContent = characteristic.name;
    card.addEventListener('click', () => {
      if (selectedRollIndex === null) return;
      assignRoll(selectedRollIndex, characteristic.id);
    });
    card.addEventListener('dragover', (event) => {
      event.preventDefault();
      event.dataTransfer.dropEffect = 'move';
    });
    card.addEventListener('dragenter', (event) => {
      event.preventDefault();
      card.classList.add('is-drop-target');
    });
    card.addEventListener('dragleave', (event) => {
      if (!card.contains(event.relatedTarget)) card.classList.remove('is-drop-target');
    });
    card.addEventListener('drop', (event) => {
      event.preventDefault();
      card.classList.remove('is-drop-target');
      const index = Number(event.dataTransfer.getData('text/plain'));
      if (Number.isInteger(index) && rolls[index] !== null) assignRoll(index, characteristic.id);
    });
    card.addEventListener('keydown', (event) => {
      if ((event.key === 'Backspace' || event.key === 'Delete') && rollAssignments.has(characteristic.id)) {
        event.preventDefault();
        removeRollAssignment(rollAssignments.get(characteristic.id));
        card.focus();
      }
    });
    return card;
  }));
  renderAllocation();
}

function assignRoll(rollIndex, characteristicId) {
  if (rolls[rollIndex] === null) return;
  const previousEntry = [...rollAssignments.entries()].find(([, assignedIndex]) => assignedIndex === rollIndex);
  const previousCharacteristicId = previousEntry?.[0] ?? null;
  const displacedRoll = rollAssignments.get(characteristicId) ?? null;

  if (previousCharacteristicId === characteristicId) {
    selectedRollIndex = null;
    renderAllocation();
    return;
  }

  if (previousCharacteristicId && displacedRoll !== null) {
    rollAssignments.set(previousCharacteristicId, displacedRoll);
  } else if (previousCharacteristicId) {
    rollAssignments.delete(previousCharacteristicId);
  }
  rollAssignments.set(characteristicId, rollIndex);
  selectedRollIndex = null;
  const characteristicName = characteristicsById.get(characteristicId).name;
  const values = getAssignedValues(rollIndex, characteristicId);
  setAllocationStatus(`${values.temporary} / ${values.potential} attribué à ${characteristicName}.`);
  renderAllocation();
}

function renderAllocation() {
  const assignedByRoll = new Map([...rollAssignments.entries()].map(([characteristicId, rollIndex]) => [rollIndex, characteristicId]));
  document.querySelectorAll('.roll-card').forEach((card) => {
    const index = Number(card.dataset.rollIndex);
    const result = rolls[index];
    const assignment = assignedByRoll.get(index);
    card.draggable = result !== null;
    card.classList.toggle('is-rolled', result !== null);
    card.classList.toggle('is-selected', selectedRollIndex === index);
    card.classList.toggle('is-assigned', Boolean(assignment));
    card.querySelector('.roll-invitation').hidden = result !== null;
    card.querySelector('.roll-values').hidden = result === null;
    if (result !== null) {
      card.querySelector('.temporary-value').textContent = String(result.temporary);
      card.querySelector('.potential-roll-value').textContent = String(result.potentialRoll);
      card.querySelector('.potential-stat-value').textContent = result.potentialValue ?? '—';
    }
    card.querySelector('.roll-assignment').textContent = assignment ? characteristicsById.get(assignment).id : '';
    card.setAttribute('aria-label', result === null
      ? `Tirage ${index + 1} : cliquer pour lancer les dés`
      : `Tirage ${index + 1} : temporaire ${result.temporary}, jet de potentiel ${result.potentialRoll}, potentielle ${result.potentialValue ?? 'aucune'}.${assignment ? ` Attribué à ${characteristicsById.get(assignment).name}.` : ''}`);
  });

  document.querySelectorAll('.characteristic-card').forEach((card) => {
    const characteristicId = card.dataset.characteristicId;
    const rollIndex = rollAssignments.get(characteristicId);
    const result = rollIndex === undefined ? null : getAssignedValues(rollIndex, characteristicId);
    card.classList.toggle('has-value', result !== null);
    card.classList.toggle('is-drop-target', false);
    card.classList.toggle('is-prime-requisite', mainCharacteristicIds.has(characteristicId));
    card.querySelector('.characteristic-temporary').textContent = result === null ? '—' : String(result.temporary);
    card.querySelector('.characteristic-potential').textContent = result === null ? '—' : String(result.potential);
    card.setAttribute('aria-label', `${characteristicsById.get(characteristicId).name}${mainCharacteristicIds.has(characteristicId) ? ', caractéristique principale' : ''} : ${result === null ? 'aucune valeur attribuée' : `temporaire ${result.temporary}, potentiel ${result.potential}`}`);
  });

  const rolledCount = rolls.filter((value) => value !== null).length;
  document.querySelector('#roll-progress').textContent = `${rolledCount} / 10 lancés`;
  document.querySelector('#assignment-progress').textContent = `${rollAssignments.size} / ${characteristicsInOrder.length} attribuées`;
  renderDevelopmentPoints();
  updateStepAvailability();
}

function renderDevelopmentPoints() {
  const totalElement = document.querySelector('#development-points-total');
  if (characteristicsInOrder.length !== 10 || rollAssignments.size !== 10 || characteristicBonusRows.length === 0) {
    baseDevelopmentPoints = null;
    totalElement.textContent = '—';
    document.querySelector('#development-points-base').textContent = '—';
    document.querySelector('#development-points-spent').textContent = String(getTotalSkillSpend());
    renderSkillList();
    renderAcquiredSkills();
    return;
  }

  let total = 0;
  for (const characteristic of characteristicsInOrder.filter((item) => item.development === true)) {
    const rollIndex = rollAssignments.get(characteristic.id);
    if (rollIndex === undefined) {
      baseDevelopmentPoints = null;
      totalElement.textContent = '—';
      document.querySelector('#development-points-base').textContent = '—';
      document.querySelector('#development-points-spent').textContent = String(getTotalSkillSpend());
      renderSkillList();
      renderAcquiredSkills();
      return;
    }
    const temporary = getAssignedValues(rollIndex, characteristic.id).temporary;
    const bonusRow = characteristicBonusRows.find((row) => temporary >= row.min && (row.max === null || temporary <= row.max));
    if (!bonusRow) {
      baseDevelopmentPoints = null;
      totalElement.textContent = '—';
      document.querySelector('#development-points-base').textContent = '—';
      document.querySelector('#development-points-spent').textContent = String(getTotalSkillSpend());
      renderSkillList();
      renderAcquiredSkills();
      return;
    }
    total += bonusRow.developmentPoints;
  }
  baseDevelopmentPoints = total;
  const spent = getTotalSkillSpend();
  document.querySelector('#development-points-base').textContent = String(total);
  document.querySelector('#development-points-spent').textContent = String(spent);
  totalElement.textContent = String(total - spent);
  renderSkillList();
  renderAcquiredSkills();
}

function getTotalSkillSpend() {
  return [...acquiredSkills.values()].reduce((sum, entry) => sum + entry.spent, 0);
}

function isWeaponCategorySkill(skill) {
  return skill.special === 'categorie-arme';
}

function needsCustomSkillSpecial(skill) {
  return skill.special !== null && typeof skill.special === 'object' && skill.special.required === true;
}

function getSkillCostEntry(skill) {
  const profession = professionsById.get(professionSelect.value);
  if (!profession || !Array.isArray(profession.skillCost)) return null;
  return profession.skillCost.find((entry) => entry.skillId === skill.id || entry.name === skill.id) || null;
}

function getWeaponCategoryCostEntry() {
  const profession = professionsById.get(professionSelect.value);
  return profession?.skillCost?.find((entry) => entry.name === 'categorie-armes') || null;
}

function getAvailableWeaponCostIndex() {
  const entry = getWeaponCategoryCostEntry();
  if (!entry || !Array.isArray(entry.costs)) return undefined;
  const usedIndexes = new Set([...acquiredSkills.values()]
    .filter((state) => state.categoryCostIndex !== undefined)
    .map((state) => state.categoryCostIndex));
  const availableIndex = entry.costs.findIndex((_, index) => !usedIndexes.has(index));
  return availableIndex < 0 ? undefined : availableIndex;
}

function getSkillCostDefinition(skill, categoryCostIndex) {
  const rawCost = isWeaponCategorySkill(skill)
    ? getWeaponCategoryCostEntry()?.costs?.[categoryCostIndex]
    : getSkillCostEntry(skill)?.costs?.[0];
  return rawCost === undefined ? [] : String(rawCost).split('/');
}

function getSkillCostAtRank(skill, categoryCostIndex, rankIndex) {
  const parts = getSkillCostDefinition(skill, categoryCostIndex);
  if (parts.length === 0 || rankIndex < 0) return undefined;

  const repeatsLastCost = parts.at(-1) === '*';
  const repeatCostIndex = parts.length - 2;
  const part = repeatsLastCost && rankIndex >= repeatCostIndex
    ? parts[repeatCostIndex]
    : parts[rankIndex];
  if (part === undefined || part === '*') return undefined;

  const cost = Number(part);
  return Number.isFinite(cost) ? cost : undefined;
}

function getSkillKey(skillId, special = '') {
  return `${skillId}::${special.trim().toLocaleLowerCase('fr-FR')}`;
}

function getSkillSpecial(skill, row = null) {
  if (!needsCustomSkillSpecial(skill)) return '';
  return row?.querySelector('.skill-special-input')?.value.trim() ?? skillSpecialValues.get(skill.id) ?? '';
}

function getNextSkillCost(skill, rank, key) {
  const state = acquiredSkills.get(key);
  const categoryCostIndex = isWeaponCategorySkill(skill)
    ? state?.categoryCostIndex ?? getAvailableWeaponCostIndex()
    : undefined;
  return {
    cost: getSkillCostAtRank(skill, categoryCostIndex, rank),
    categoryCostIndex
  };
}

function renderSkillList() {
  const skillList = document.querySelector('#skill-list');
  skillList.replaceChildren(...skills.map((skill) => {
    const row = document.createElement('article');
    row.className = 'skill-row';
    row.dataset.skillId = skill.id;
    const primary = document.createElement('div');
    primary.className = 'skill-primary';
    const name = document.createElement('h3');
    name.textContent = skill.name;
    const description = document.createElement('p');
    description.className = 'skill-offer-details';
    description.textContent = `${skill.category} · ${skill.type}`;
    primary.append(name, description);

    const characteristics = document.createElement('div');
    characteristics.className = 'skill-characteristics';
    skill.characteristics.forEach((reference) => {
      const chip = document.createElement('span');
      chip.className = 'skill-characteristic-chip';
      chip.textContent = reference.split('/').map((id) => characteristicsById.get(id.trim()).name).join(' / ');
      characteristics.append(chip);
    });
    primary.append(characteristics);

    let specialInput = null;
    if (needsCustomSkillSpecial(skill)) {
      const specialLabel = document.createElement('label');
      specialLabel.className = 'skill-special-label';
      specialLabel.textContent = 'Spécialité';
      specialInput = document.createElement('input');
      specialInput.className = 'skill-special-input';
      specialInput.type = 'text';
      specialInput.placeholder = 'Ex. épée longue';
      specialInput.value = skillSpecialValues.get(skill.id) || '';
      specialLabel.append(specialInput);
      primary.append(specialLabel);
    }

    const purchase = document.createElement('div');
    purchase.className = 'skill-purchase';
    const nextCostLabel = document.createElement('span');
    nextCostLabel.className = 'next-rank-cost';
    const buyButton = document.createElement('button');
    buyButton.type = 'button';
    buyButton.className = 'buy-rank-button';
    buyButton.textContent = 'Acheter';
    const updateOffer = () => {
      const special = getSkillSpecial(skill, row);
      const state = acquiredSkills.get(getSkillKey(skill.id, special));
      const rank = state?.rank ?? 0;
      const costInfo = getNextSkillCost(skill, rank, getSkillKey(skill.id, special));
      const cost = costInfo.cost;
      const missingSpecial = Boolean(needsCustomSkillSpecial(skill) && !special);
      const noCost = cost === undefined || cost === null;
      const notEnough = typeof cost === 'number' && baseDevelopmentPoints !== null && cost > baseDevelopmentPoints - getTotalSkillSpend();
      row.draggable = !missingSpecial && !noCost && !notEnough && baseDevelopmentPoints !== null;
      buyButton.disabled = !row.draggable;
      if (missingSpecial) nextCostLabel.textContent = 'Précisez une spécialité';
      else if (baseDevelopmentPoints === null) nextCostLabel.textContent = 'Budget en attente';
      else if (noCost) nextCostLabel.textContent = 'Rang suivant indisponible';
      else if (notEnough) nextCostLabel.textContent = `Il manque ${cost - (baseDevelopmentPoints - getTotalSkillSpend())} PD`;
      else nextCostLabel.textContent = `Prochain rang · ${cost} PD${isWeaponCategorySkill(skill) ? ` · tarif ${costInfo.categoryCostIndex + 1}/6` : ''}`;
    };
    if (specialInput) {
      specialInput.addEventListener('input', () => {
        skillSpecialValues.set(skill.id, specialInput.value);
        updateOffer();
      });
    }
    buyButton.addEventListener('click', () => purchaseSkill(skill.id, getSkillSpecial(skill, row)));
    purchase.append(nextCostLabel, buyButton);
    row.append(primary, purchase);
    row.addEventListener('dragstart', (event) => {
      if (event.target.closest('input, button') || !row.draggable) {
        event.preventDefault();
        return;
      }
      const special = getSkillSpecial(skill, row);
      event.dataTransfer.setData('text/plain', JSON.stringify({ skillId: skill.id, special }));
      event.dataTransfer.effectAllowed = 'copy';
      row.classList.add('is-dragging');
    });
    row.addEventListener('dragend', () => row.classList.remove('is-dragging'));
    updateOffer();
    return row;
  }));
  const count = skills.length;
  document.querySelector('#skills-count').textContent = `${count} compétence${count > 1 ? 's' : ''}`;
}

function purchaseSkill(skillId, special = '') {
  const skill = skills.find((entry) => entry.id === skillId);
  if (!skill) return;
  const normalizedSpecial = special.trim();
  if (needsCustomSkillSpecial(skill) && !normalizedSpecial) {
    document.querySelector('#skill-purchase-status').textContent = 'Précisez la spécialité avant d’acheter cette compétence.';
    return;
  }

  const key = getSkillKey(skillId, normalizedSpecial);
  const state = acquiredSkills.get(key) || { skillId, special: normalizedSpecial, rank: 0, spent: 0 };
  const costInfo = getNextSkillCost(skill, state.rank, key);
  const cost = costInfo.cost;
  const remaining = baseDevelopmentPoints === null ? 0 : baseDevelopmentPoints - getTotalSkillSpend();
  if (cost === undefined || cost === null) {
    document.querySelector('#skill-purchase-status').textContent = 'Aucun coût supplémentaire n’est défini pour ce rang.';
    return;
  }
  if (baseDevelopmentPoints === null || cost > remaining) {
    document.querySelector('#skill-purchase-status').textContent = `Points de Développement insuffisants : ${cost} PD sont nécessaires.`;
    return;
  }

  state.rank += 1;
  state.spent += cost;
  if (isWeaponCategorySkill(skill) && state.categoryCostIndex === undefined) {
    state.categoryCostIndex = costInfo.categoryCostIndex;
  }
  acquiredSkills.set(key, state);
  document.querySelector('#skill-purchase-status').textContent = `${skill.name}${normalizedSpecial ? ` (${normalizedSpecial})` : ''} atteint le rang ${state.rank} pour ${cost} PD.`;
  renderDevelopmentPoints();
}

function renderAcquiredSkills() {
  const acquiredList = document.querySelector('#acquired-skill-list');
  acquiredList.replaceChildren();
  let totalRanks = 0;
  for (const [key, state] of acquiredSkills.entries()) {
    const skill = skills.find((entry) => entry.id === state.skillId);
    if (!skill) continue;
    totalRanks += state.rank;
    const row = document.createElement('article');
    row.className = 'acquired-skill-row';
    const details = document.createElement('div');
    details.className = 'acquired-skill-details';
    const name = document.createElement('h3');
    name.textContent = skill.name;
    const subtitle = document.createElement('p');
    subtitle.textContent = isWeaponCategorySkill(skill)
      ? `${skill.category} · tarif ${state.categoryCostIndex + 1}/6`
      : state.special ? `${state.special} · ${skill.category}` : skill.category;
    details.append(name, subtitle);

    const rankInfo = document.createElement('div');
    rankInfo.className = 'acquired-rank-info';
    const rank = document.createElement('strong');
    rank.textContent = `Rang ${state.rank}`;
    const spent = document.createElement('span');
    spent.textContent = `${state.spent} PD`;
    rankInfo.append(rank, spent);

    const removeButton = document.createElement('button');
    removeButton.type = 'button';
    removeButton.className = 'remove-rank-button';
    removeButton.textContent = '−';
    removeButton.title = 'Retirer le dernier rang et récupérer ses points';
    removeButton.setAttribute('aria-label', `Retirer le dernier rang de ${skill.name}`);
    removeButton.addEventListener('click', () => {
      const refund = getSkillCostAtRank(skill, state.categoryCostIndex, state.rank - 1);
      if (typeof refund !== 'number') return;
      state.rank -= 1;
      state.spent -= refund;
      if (state.rank === 0) acquiredSkills.delete(key);
      document.querySelector('#skill-purchase-status').textContent = `Dernier rang retiré de ${skill.name}. ${refund} PD récupérés.`;
      renderDevelopmentPoints();
    });
    row.append(details, rankInfo, removeButton);
    acquiredList.append(row);
  }
  document.querySelector('#acquired-count').textContent = `${totalRanks} rang${totalRanks === 1 ? '' : 's'}`;
}

async function loadRulesData() {
  try {
    const [professionsResponse, characteristicsResponse, racesResponse, potentialResponse, skillsResponse, bonusResponse] = await Promise.all([
      fetch('./data/professions.json'),
      fetch('./data/caractéristiques.json'),
      fetch('./data/races.json'),
      fetch('./data/potential-table.json'),
      fetch('./data/compétences.json'),
      fetch('./data/characteristic-bonuses.json')
    ]);
    if (!professionsResponse.ok || !characteristicsResponse.ok || !racesResponse.ok || !potentialResponse.ok || !skillsResponse.ok || !bonusResponse.ok) throw new Error('Fichiers de configuration indisponibles');
    const [professionData, characteristicData, raceData, potentialData, skillData, bonusData] = await Promise.all([
      professionsResponse.json(),
      characteristicsResponse.json(),
      racesResponse.json(),
      potentialResponse.json(),
      skillsResponse.json(),
      bonusResponse.json()
    ]);
    if (!Array.isArray(professionData.professions) || professionData.professions.length === 0) throw new Error('Aucune profession configurée');
    if (!Array.isArray(characteristicData.characteristics)) throw new Error('Liste de caractéristiques invalide');
    if (!Array.isArray(raceData.races) || raceData.races.length === 0) throw new Error('Aucune race configurée');
    if (!Array.isArray(potentialData.initialStatRanges) || !Array.isArray(potentialData.potentialRollRanges)) throw new Error('Table des potentiels invalide');
    if (!Array.isArray(skillData.skills) || !Array.isArray(bonusData.rows)) throw new Error('Fichiers de compétences ou de bonus invalides');
    potentialTable = potentialData;
    skills = skillData.skills;
    characteristicBonusRows = bonusData.rows;

    characteristicData.characteristics.forEach((characteristic) => {
      characteristicsById.set(characteristic.id, characteristic);
    });
    characteristicsInOrder = characteristicData.characteristics;
    createRollCards();
    createCharacteristicCards(characteristicsInOrder);

    professionSelect.replaceChildren(new Option('Sélectionnez une profession', ''));
    professionData.professions.forEach((profession) => {
      const missingRequisites = profession.primeRequisites.filter((id) => !characteristicsById.has(id));
      if (missingRequisites.length > 0) throw new Error(`Caractéristiques inconnues : ${missingRequisites.join(', ')}`);
      professionsById.set(profession.id, profession);
      professionSelect.add(new Option(profession.name, profession.id));
    });

    raceSelect.replaceChildren(new Option('Sélectionnez une race', ''));
    raceData.races.forEach((race) => {
      const missingModifiers = Object.keys(race.characteristicModifiers).filter((id) => !characteristicsById.has(id));
      if (missingModifiers.length > 0) throw new Error(`Caractéristiques inconnues pour ${race.name} : ${missingModifiers.join(', ')}`);
      racesById.set(race.id, race);
      raceSelect.add(new Option(race.name, race.id));
    });
    skills.forEach((skill) => {
      const missingCharacteristics = skill.characteristics
        .flatMap((reference) => reference.split('/').map((id) => id.trim()))
        .filter((id) => !characteristicsById.has(id));
      if (missingCharacteristics.length > 0) throw new Error(`Caractéristiques inconnues pour ${skill.name} : ${missingCharacteristics.join(', ')}`);
    });
    renderSkillList();
    professionSelect.disabled = false;
    raceSelect.disabled = false;
    updateStepAvailability();
  } catch (error) {
    professionSelect.replaceChildren(new Option('Professions indisponibles', ''));
    professionError.hidden = false;
    raceSelect.replaceChildren(new Option('Races indisponibles', ''));
    raceError.hidden = false;
    document.querySelector('#skills-error').hidden = false;
  }
}

document.querySelector('#new-character').addEventListener('click', () => showView('creation'));
document.querySelector('#back-home').addEventListener('click', () => showView('home'));
document.querySelector('#back-profession').addEventListener('click', () => showView('creation'));
document.querySelector('#back-characteristics').addEventListener('click', () => showView('characteristics'));
continueButton.addEventListener('click', () => showView('characteristics'));
continueSkillsButton.addEventListener('click', () => showView('skills'));
homeStep.addEventListener('click', () => showView('home'));
professionStep.addEventListener('click', () => showView('creation'));
characteristicsStep.addEventListener('click', () => showView('characteristics'));
skillsStep.addEventListener('click', () => showView('skills'));

const acquiredSkillList = document.querySelector('#acquired-skill-list');
acquiredSkillList.addEventListener('dragover', (event) => {
  event.preventDefault();
  event.dataTransfer.dropEffect = 'copy';
  acquiredSkillList.classList.add('is-drop-target');
});
acquiredSkillList.addEventListener('dragleave', (event) => {
  if (!acquiredSkillList.contains(event.relatedTarget)) acquiredSkillList.classList.remove('is-drop-target');
});
acquiredSkillList.addEventListener('drop', (event) => {
  event.preventDefault();
  acquiredSkillList.classList.remove('is-drop-target');
  try {
    const { skillId, special } = JSON.parse(event.dataTransfer.getData('text/plain'));
    purchaseSkill(skillId, special);
  } catch (error) {
    document.querySelector('#skill-purchase-status').textContent = 'Cette compétence ne peut pas être achetée.';
  }
});

professionSelect.addEventListener('change', () => {
  if (selectedProfessionId && selectedProfessionId !== professionSelect.value) {
    acquiredSkills.clear();
    document.querySelector('#skill-purchase-status').textContent = 'Les compétences acquises ont été retirées car la profession a changé.';
  }
  selectedProfessionId = professionSelect.value;
  renderProfession(professionsById.get(professionSelect.value));
  updateStepAvailability();
});
raceSelect.addEventListener('change', () => {
  selectedRace = racesById.get(raceSelect.value) || null;
  renderRacePresentation();
  updateStepAvailability();
});

loadRulesData();
