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
  continueButton.disabled = !hasIdentity;
  characteristicsStep.disabled = !hasIdentity;
  characteristicsStep.toggleAttribute('aria-disabled', !hasIdentity);
  characteristicsStep.title = hasIdentity ? '' : 'Choisissez d’abord une race et une profession';
  characteristicsStep.classList.toggle('is-locked', !hasIdentity);
  continueSkillsButton.disabled = !allCharacteristicsAssigned;
  skillsStep.disabled = !allCharacteristicsAssigned;
  skillsStep.toggleAttribute('aria-disabled', !allCharacteristicsAssigned);
  skillsStep.title = allCharacteristicsAssigned ? '' : 'Attribuez les dix caractéristiques pour continuer';
  skillsStep.classList.toggle('is-locked', !allCharacteristicsAssigned);

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
    totalElement.textContent = '—';
    return;
  }

  let total = 0;
  for (const characteristic of characteristicsInOrder.filter((item) => item.development === true)) {
    const rollIndex = rollAssignments.get(characteristic.id);
    if (rollIndex === undefined) {
      totalElement.textContent = '—';
      return;
    }
    const temporary = getAssignedValues(rollIndex, characteristic.id).temporary;
    const bonusRow = characteristicBonusRows.find((row) => temporary >= row.min && (row.max === null || temporary <= row.max));
    if (!bonusRow) {
      totalElement.textContent = '—';
      return;
    }
    total += bonusRow.developmentPoints;
  }
  totalElement.textContent = String(total);
}

function renderSkillList() {
  const skillList = document.querySelector('#skill-list');
  skillList.replaceChildren(...skills.map((skill) => {
    const row = document.createElement('article');
    row.className = 'skill-row';
    const primary = document.createElement('div');
    primary.className = 'skill-primary';
    const name = document.createElement('h3');
    name.textContent = skill.name;
    const characteristics = document.createElement('div');
    characteristics.className = 'skill-characteristics';
    skill.characteristics.forEach((id) => {
      const chip = document.createElement('span');
      chip.className = 'skill-characteristic-chip';
      chip.textContent = characteristicsById.get(id).name;
      characteristics.append(chip);
    });
    primary.append(name, characteristics);

    const metadata = document.createElement('div');
    metadata.className = 'skill-metadata';
    const category = document.createElement('span');
    category.className = 'skill-category';
    category.textContent = skill.category;
    const type = document.createElement('span');
    type.className = 'skill-type';
    type.textContent = skill.type;
    metadata.append(category, type);
    row.append(primary, metadata);
    return row;
  }));
  const count = skills.length;
  document.querySelector('#skills-count').textContent = `${count} compétence${count > 1 ? 's' : ''}`;
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
      const missingCharacteristics = skill.characteristics.filter((id) => !characteristicsById.has(id));
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

professionSelect.addEventListener('change', () => {
  renderProfession(professionsById.get(professionSelect.value));
  updateStepAvailability();
});
raceSelect.addEventListener('change', () => {
  selectedRace = racesById.get(raceSelect.value) || null;
  renderRacePresentation();
  updateStepAvailability();
});

loadRulesData();
