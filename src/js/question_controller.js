import { Application, Controller } from "./stimulus.js";

/**
 * Generates mock user answers for testing political compass calculations
 * @param {number} count - Number of answers to generate (default: 60)
 * @returns {Object} Object with question indices as keys and mock answer objects as values
 */
function mockAnswers(count = 60) {
  const types = ["social", "económico", "política"];
  const mockAnswers = {};

  for (let i = 0; i < count; i++) {
    const type = types[Math.floor(Math.random() * types.length)];
    const multiplier = Math.random() < 0.5 ? -1 : 1;

    // Generate answer values between -2 and 2
    // -2, -1, 0, 1, or 2
    const answerValue = Math.floor(Math.random() * 5) - 2;

    mockAnswers[i] = {
      answer: answerValue,
      index: i,
      multiplier: multiplier,
      type: type
    };
  }

  return mockAnswers;
}


/**
 * Returns a hex color along the gradient between two colors
 * @param {string} color1 - Starting hex color (format: '#RRGGBB' or '#RGB')
 * @param {string} color2 - Ending hex color (format: '#RRGGBB' or '#RGB')
 * @param {number} percent - Value between 0 and 1
 * @returns {string} Resulting hex color
 */
function getGradientColor(color1, color2, percent) {
  // Convert hex colors to RGB
  const parseHex = (hex) => {
    // Remove # if present
    hex = hex.replace('#', '');

    // Handle shorthand hex (#RGB)
    if (hex.length === 3) {
      hex = hex.split('').map(char => char + char).join('');
    }

    // Parse RGB values
    const r = parseInt(hex.substring(0, 2), 16);
    const g = parseInt(hex.substring(2, 4), 16);
    const b = parseInt(hex.substring(4, 6), 16);

    return [r, g, b];
  };

  const [r1, g1, b1] = parseHex(color1);
  const [r2, g2, b2] = parseHex(color2);

  // Calculate new color values
  const r = Math.round(r1 + (r2 - r1) * percent);
  const g = Math.round(g1 + (g2 - g1) * percent);
  const b = Math.round(b1 + (b2 - b1) * percent);

  // Convert back to hex
  const toHex = (value) => {
    const hex = value.toString(16);
    return hex.length === 1 ? '0' + hex : hex;
  };
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

const getPoliticalColor = (percentage) => {
  const startingColor = '#D92372'
  const endingColor = '#33D927'
  return getGradientColor(startingColor, endingColor, percentage)
}

/**
 * Calculate political party affinity scores based on question answers.
 *
 * @param {Object} userAnswers - Dictionary with question_id as key and user's answer (numeric) as value
 * @param {Object} partyAnswers - Dictionary where keys are party names and values are dictionaries of {question_id: answer}
 * @param {Array} questionIds - Optional list of question IDs to consider. If null, uses all keys in userAnswers
 * @param {number} maxDiffPerQuestion - Maximum possible difference between answers for a single question
 * @returns {Object} Dictionary of party names and their affinity scores (0-1 scale), sorted by descending affinity
 */
function calculatePartyAffinity(userAnswers, partyAnswers, questionIds = null, maxDiffPerQuestion = 4) {
  // Use provided questionIds or all keys from userAnswers
  questionIds = questionIds || Object.keys(userAnswers);

  // Filter to only include questions the user answered
  const answeredQuestions = questionIds.filter(qId => qId in userAnswers);
  const numAnswered = answeredQuestions.length;

  if (numAnswered === 0) {
    return {};  // No answers to evaluate
  }

  // Calculate distance between user answers and each party's answers
  const distances = {};
  for (const [partyName, partyPositions] of Object.entries(partyAnswers)) {
    let totalDifference = 0;
    for (const questionId of answeredQuestions) {
      if (questionId in partyPositions) {
        const difference = Math.abs(userAnswers[questionId] - partyPositions[questionId]);
        totalDifference += difference;
      }
    }
    distances[partyName] = totalDifference;
  }

  // Calculate maximum possible distance
  const maxPossibleDistance = maxDiffPerQuestion * numAnswered;

  // Convert distances to affinity scores (0-1 scale)
  const affinityScores = {};
  for (const [party, distance] of Object.entries(distances)) {
    affinityScores[party] = Math.max(0.0, Math.min(1.0, 1 - (distance / maxPossibleDistance)));
  }

  // Sort by descending affinity score
  const sortedEntries = Object.entries(affinityScores).sort((a, b) => b[1] - a[1]);
  const sortedScores = Object.fromEntries(sortedEntries);

  return sortedScores;
}

/**
 * Convert coordinates from (-1, 1) range to CSS position.
 *
 * @param {number} x - X coordinate in (-1, 1) range
 * @param {number} y - Y coordinate in (-1, 1) range
 * @returns {Object} Object with 'left' and 'top' as percentage strings
 *
 * Coordinate system:
 * (-1, 1) is top-left
 * (1, 1) is top-right
 * (-1, -1) is bottom-left
 * (1, -1) is bottom-right
 */
function tupleToCssPosition(x, y) {
  // To center your own logo.
  let offset = 2.5;
  // Map x from (-1, 1) to (0%, 100%)
  let leftPercent = ((x + 1) / 2) * 100;
  leftPercent = leftPercent - offset;

  // Map y from (1, -1) to (0%, 100%)
  // Note: We invert y because in CSS, top: 0% is the top of the container
  // and top: 100% is the bottom, while in our coordinate system,
  // y=1 is top and y=-1 is bottom
  let topPercent = ((1 - y) / 2) * 100;
  topPercent = topPercent - offset;


  return {
    left: `${leftPercent}%`,
    top: `${topPercent}%`
  };
}

/**
 * Calculates Economic, Social, and Political scores (-1 to 1) using multipliers.
 * @param {Array} questions - Array of question objects with properties type, multiplier, and answer
 * @returns {Object} Object containing economic, social, and political scores
 */
function calculateCompassScores(questions) {
  const scores = { economic: 0.0, social: 0.0, political: 0.0 };

  // Filter questions by type
  const socialQuestions = questions.filter(q => q.type === "social");
  const economicQuestions = questions.filter(q => q.type === "económico");
  const politicalQuestions = questions.filter(q => q.type === "política");

  const axisDefinitions = {
    economic: economicQuestions,
    social: socialQuestions,
    political: politicalQuestions
  };

  // Calculate scores for each axis
  for (const [axisName, axisQuestions] of Object.entries(axisDefinitions)) {
    // Extract answers and multipliers for this axis
    const validAnswers = axisQuestions.map(q => q.answer);
    const relevantMultipliers = axisQuestions.map(q => q.multiplier);

    const numAnswered = validAnswers.length;

    // Skip if no questions answered for this category
    if (numAnswered === 0) continue;

    // Calculate weighted sum
    const weightedScoreSum = validAnswers.reduce((sum, answer, index) => {
      return sum + (answer * relevantMultipliers[index]);
    }, 0);

    // Normalize score between -1 and 1
    const normalizedScore = weightedScoreSum / (numAnswered * 2.0);
    scores[axisName] = Math.max(-1.0, Math.min(1.0, normalizedScore));
  }

  // Make the score between 0 and 1, so that it is equivalent to a percentage value.
  let normalizedPoliticalScore = ((scores.political + 1) / 2);
  let political = {politicalColor: getPoliticalColor(normalizedPoliticalScore)}
  return { ...scores, ...tupleToCssPosition(scores.economic, scores.social), ...political };
}

const createCircle = (percent) => {
  let circumference = 2* Math.PI * 80 // is a set value in svg
  let offset = (1 - percent) * circumference
  let number = Math.round(percent * 100, 0)

  let svg = document.querySelector("#circle").innerHTML
  svg = svg.replace("${offset}", offset)
  svg = svg.replace("${number}", number + "%")
  return svg
}

const createChart = (parties, you) => {
  let dots = ``

  for (let p of parties) {
    dots = dots + `<div title="${p.fullname}" class="party ${p.key}" style="left: ${p.left}; top: ${p.top}"></div>`
  }
  dots = dots + `<div title="YOU" class="party you" style="left: ${you.left}; top: ${you.top};"></div>`

  let html = `
    <div class="economic-indicator"></div>
    <div class="text-s top-label">Progressista</div>
    <div class="text-s bottom-label">Conservador</div>
    <div class="text-s left-label">Esquerda</div>
    <div class="text-s right-label">Direita</div>


    <div class="relative compass-container">
      <div class="main-horizontal dotted-spaced"></div>
      <div class="main-vertical left dotted-spaced"></div>
      ${dots}
    </div>
  `

  return html
}

const createPartyTable = (affinities, parties) => {
  let html = `
    <div class="party-table-info" data-controller="pulldown">
      <p class="text-ss">
        Este gráfico mostra a concordância geral com base em todas as suas respostas. Para cada afirmação, uma resposta mais distante do utilizador em relação à respostade um determinado partido, diminui a semelhança com esse partido.
      </p>
      <p class="text-ss">
        Nota: O teste dá o mesmo peso a todas as afirmações, o que normalmente não reflete as preferências dos eleitores. Assim, é útil considerar não apenas o partido com maior percentagem de semelhança, mas também o partidos com percentagens próximas.
      </p>
      <div class="center pointer" data-action="click->pulldown#pullDown">
        <img src="./images/arrow_down.svg"
          data-pulldown-target="arrow"
        >
      </div>
    </div>
  `

  for (let [party, affinity] of affinities) {
    let percent = Math.round(100 * affinity, 0)
    let rest = 100 - percent
    let row = `
      <div
          class="party-row pointer"
          data-party="${parties[party].key}" data-percent="${affinity}"
          data-action="click->question#showParty"
      >
        <img src="../images/logos/${parties[party].key}.png" alt="${parties[party].abbreviation}" \>
        <div class="party-bar-container" style="flex-grow: ${percent}">
            <div class="party-name">
              ${parties[party].abbreviation} <img src="./images/right_arrow.svg">
            </div>
        </div>
          <div style="flex-grow: ${rest}">
            <div class="party-percentage">${percent}%</div>
          </div>
        </div>
        `
    html = html + row
  }
  return html
}


const createParty = (party, percent) => {
  let svg = createCircle(percent)
  let data = `
      <div id="party-box" class="content-box party-box">
        <div class="dialog-close pointer" onClick="document.querySelector('dialog').close()">
          <img src="./images/cross.svg">
        </div>
        <div class="party-card">
            <div class="left-column">
                <div>
                    <div class="logo-placeholder mb-5">
                      <a href=${party.website}><img class="logo" src="./images/logos/${party.key}.png"></a>
                    </div>
                    <h3>${party.abbreviation}</h3>
                    <h3>${party.fullname}</h3>
                    <div class="text-secondary text-ss italic">${party.leaning}</div>
                    <div>
                      <a href="${party.programme}">Programa Eleitoral</a>
                      <a href="${party.website}">Site Oficial</a>
                    </div>
                </div>
                <p class="party-description text-ss mt-2">${party.blurb}</p>
            </div>
            <div class="right-column">
              ${svg}
            </div>
        </div>
    </div>
  `
  return data
}

class PullDownController extends Controller {
  static targets = [
    "arrow"
  ]


  pullDown() {
    this.element.classList.toggle("down")
    this.arrowTarget.classList.toggle("arrow-down")
  }
}

class ScrollController extends Controller {
  toQuestion() {
    this.scrollTo(".question-box", 40)
  }

  toResults() {
    this.scrollTo("#party-box", 160)
  }

  scrollTo(selector, offset) {
    var element = document.querySelector(selector);
    var elementPosition = element.getBoundingClientRect().top;
    var offsetPosition = elementPosition + window.pageYOffset - offset;

    window.scrollTo({
         top: offsetPosition,
         behavior: "smooth"
    });
  }
}


class QuestionController extends Controller {
  static targets = [
    "answer",
    "content",
    "complete",
    "correctBtn",
    "circleFragment",
    "next",
    "number",
    "previous",
    "question",
    "questionCount",
    "result",
    "theme",
    "total_q",
    "type",
  ]

  async initialize() {
    await this.loadQuestions()
    await this.loadPartyData()
    await this.loadPartyAnswers()
  }

  connect() {
    this.currentQuestion = 0
    this.userAnswers = {}
  }

  init(event) {
    // Test the last questions.
    // this.userAnswers = mockAnswers(60)
    // this.currentQuestion = 23

    let questions = event.detail

    this.shortQuestions = questions.filter((q) => { return q.short })
    this.longQuestions = questions.filter((q) => { return !q.short })

    this.questions = this.shortQuestions
    this.totalQ = this.questions.length
    this.halfway = false

    this.setQuestion(this.currentQuestion)
  }

  setQuestion(num) {
    this.currentQuestion = num
    this.questionTarget.innerHTML = this.questions[num].pergunta
    this.total_qTarget.innerHTML = this.totalQ
    this.typeTarget.innerHTML = this.questions[num].type
    this.themeTarget.innerHTML = this.questions[num].theme
    this.numberTarget.innerHTML = this.currentQuestion + 1
  }

  setExistingAnswer() {
    let answer = this.userAnswers[this.currentQuestion]?.answer
    this.answerTargets.map((target) => {
      if (answer == undefined) {
        target.checked = false
      } else if (parseInt(target.value) ==  answer || isNaN(answer)) {
        target.checked = true
      } else {
        // target does not match, do nothing.
      }
    })
  }

  next() {
    if (!this.canProceed() || this.showHalfway(this.currentQuestion + 1)) {
      return
    }

    this.setQuestion(this.currentQuestion + 1)
    this.setExistingAnswer()
    this.canProceed()
  }

  previous() {
    this.setQuestion(this.currentQuestion - 1)
    this.setExistingAnswer()
    this.canProceed()
  }

  complete() {
    // Shows the halfway screen
    this.showHalfway(24)
  }

  showHalfway(num) {
    if (num == this.questions.length) {
      this.questionCountTarget.classList.add("hidden")
      this.nextTarget.classList.add("hidden")
      this.previousTarget.classList.add("hidden")
      this.completeTarget.classList.remove("hidden")
      this.correctBtnTarget.classList.add("hidden")

      let answerCount = Object.values(this.userAnswers).filter((q) => !isNaN(q.answer)).length
      this.questionnaireHTML = this.contentTarget.innerHTML
      this.contentTarget.innerHTML = `
        <div class="text-m center flex-column auto">
          <p>Respondeu a ${answerCount} das 60 perguntas.</p>
          <p>Pare aqui ou prossiga com o teste completo.</p>

          <div class="review">
            <span class="text-ss text-secondary">Mudou de ideias?</span>
            <p class="text-ss underline pointer" data-action="click->question#review">
              Rever as respostas
            </p>
          </div>
        </div>
      `
      return true
    }
  }

  takeAllQuestions() {
    this.questions = this.shortQuestions.concat(this.longQuestions)
    this.totalQ = this.questions.length
    this._resetQuestionnaire()
    this.setQuestion(24)
    this.setExistingAnswer()
  }

  _changePoliticalColor(parties, you) {
    for (let p of parties) {
      let style = document.querySelector(`.party.${p.key}`).style
      let color = p.politicalColor || getPoliticalColor(((p.political + 1) / 2))
      style.setProperty('--politicalColor', color)
    }
    let style = document.querySelector(`.party.you`).style
    style.setProperty('--politicalColor', you.politicalColor)
  }

  showParty(event) {
    let dialog = document.querySelector("dialog")
    let party = event.currentTarget.dataset.party
    let percent = event.currentTarget.dataset.percent
    dialog.innerHTML = createParty(this.parties[party], percent)
    dialog.showModal()
  }

  showSharing(event) {
    let sharing = document.querySelector(".sharing")
    let [partyKey, percent] = this.getFirstResult()
    let partyName = this.parties[partyKey].abbreviation.replace(' ', '+')
    partyName = encodeURI(partyName)
    percent = Math.round(percent * 100, 0)
    let deployedUrl = 'votimetro.app'
    let subject = 'O+meu+resultado+no+Vot%C3%ADmetro'
    let body = `Fiz+o+teste+Vot%C3%ADmetro%21+O+meu+partido+mais+pr%C3%B3ximo+foi+${partyName}+%28${percent}%25%29.+Descobre+a+tua+posi%C3%A7%C3%A3o%3A+https%3A%2F%2F${deployedUrl}`

    sharing.innerHTML = `
      <a href="https://www.facebook.com/sharer/sharer.php?u=https%3A%2F%2F${deployedUrl}" aria-label="Partilhar no Facebook">
        <img src="./images/facebook.svg">
      </a>
      <a href="https://wa.me/?text=${body}+https%3A%2F%2F${deployedUrl}" aria-label="Partilhar no Whatsapp"><img src="./images/whatsapp.svg"></a>
      <a href="mailto:?subject=${subject}&body=${body}
" aria-label="Partilhar por Email"><img src="./images/email.svg"></a>
      <a href="https://twitter.com/intent/tweet?text=${body}&hashtags=Votimetro,PoliticaPortuguesa
" aria-label="Partilhar no X (Twitter)"><img src="./images/twitter.svg"></a>
    `
    sharing.classList.add("down")
  }

  getFirstResult() {
    let [party, percent] = Object.entries(this.userAffinities)[0]
    return [party, percent]
  }

  showResults() {
    let score = calculateCompassScores(Object.values(this.userAnswers))
    console.log(score)

    let answers = {}
    for (let q of Object.values(this.userAnswers)) {
      answers[q.index] = q.answer
    }
    let userAffinities = calculatePartyAffinity(answers, this.partyAnswers)
    this.userAffinities = userAffinities

    this.resultTarget.classList.remove("hidden")
    this.resultTarget.classList.remove("invisible")
    let you = {left: score.left, top: score.top, politicalColor: score.politicalColor}
    document.querySelector("#chart").innerHTML = createChart(Object.values(this.parties), you)
    this._changePoliticalColor(Object.values(this.parties), you)

    let affinities = Object.entries(userAffinities)
    let [party, percent] = affinities[0]
    let data = createParty(this.parties[party], percent)
    document.querySelector("#party-table").innerHTML = createPartyTable(affinities, this.parties)
    this.resultTarget.querySelector("#party-box").outerHTML = data
  }

  _resetQuestionnaire() {
    this.contentTarget.innerHTML = this.questionnaireHTML
    this.nextTarget.classList.remove("hidden")
    this.previousTarget.classList.remove("hidden")
    this.completeTarget.classList.add("hidden")
    this.correctBtnTarget.classList.remove("hidden")
    this.questionCountTarget.classList.remove("hidden")
  }

  review() {
    this._resetQuestionnaire()
    this.setQuestion(0)
    this.setExistingAnswer()
  }

  canProceed() {
    let isChecked = this.answerTargets.filter((target) => target.checked == true).length >= 1
    if (this.userAnswers[this.currentQuestion] != undefined || isChecked ) {
      this.nextTarget.removeAttribute("disabled")
      return true
    }
    this.nextTarget.setAttribute("disabled", "disabled")
    return false
  }

  answer(event) {
    const parsedValue = parseInt(event.target.value);

    // Only add to userAnswers if the parsed value is a valid number
    if (!isNaN(parsedValue)) {
      this.userAnswers[this.currentQuestion] = {
        answer: parsedValue,
        index: this.questions[this.currentQuestion].index,
        multiplier: this.questions[this.currentQuestion].multiplier,
        type: this.questions[this.currentQuestion].type
      }
    }
    this.canProceed()
  }

  handleKeyPress(event) {
    if (event.key === 'Enter') {
      event.preventDefault();
      const radio = event.currentTarget.querySelector('input[type="radio"]');
      if (radio) {
        radio.checked = true;
        const radioEvent = {
          target: radio,
          value: radio.value
        };
        this.answer(radioEvent);
        this.next();
      }
    }
  }

  async loadQuestions() {
    try {
      const response = await fetch('./questions.json');
      const data = await response.json();
      this.dispatch("ready", {detail: data})
      return data;
    } catch (error) {
      console.error('Error loading JSON:', error);
    }
  }

  async loadPartyData() {
    try {
      const response = await fetch('./party_info.json');
      const data = await response.json();
      this.parties = data
    } catch (error) {
      console.error('Error loading JSON:', error);
    }
  }

  async loadPartyAnswers() {
    try {
      const response = await fetch('./party_answers.json');
      const data = await response.json();
      this.partyAnswers = data
    } catch (error) {
      console.error('Error loading JSON:', error);
    }
  }

}


window.Stimulus = Application.start()
Stimulus.register("question", QuestionController)
Stimulus.register("scroll", ScrollController)
Stimulus.register("pulldown", PullDownController)
