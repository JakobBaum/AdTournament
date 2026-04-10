import { TournamentDB } from "./TournamentDB.js";

export class Logik {
  constructor() {
    this.db = new TournamentDB();
  }

  generateTournament(players, playersPerGroup = 4, qualifiedPerGroup = 2) {
    if (!Array.isArray(players) || players.length < 2) {
      throw new Error("Mindestens 2 Spieler nötig");
    }

    const shuffled = [...players].sort(() => Math.random() - 0.5);

    const groups = [];
    const matches = [];
    const numGroups = Math.ceil(shuffled.length / playersPerGroup);

    // =========================
    // 👥 GRUPPEN
    // =========================
    for (let g = 0; g < numGroups; g++) {
      const start = g * playersPerGroup;
      const end = start + playersPerGroup;
      const groupPlayers = shuffled.slice(start, end);

      const groupLetter = String.fromCharCode(65 + g);
      const groupName = `Gruppe ${groupLetter}`;

      groups.push({
        name: groupName,
        players: groupPlayers,
      });

      let groupMatchCounter = 1;

      for (let i = 0; i < groupPlayers.length; i++) {
        for (let j = i + 1; j < groupPlayers.length; j++) {
          matches.push({
            matchNumber: `${groupLetter}-${groupMatchCounter}`,
            round: 1,
            group: groupName,
            player1: groupPlayers[i],
            player2: groupPlayers[j],
            winner: null,
            status: "pending",
            boardId: null,
          });

          groupMatchCounter++;
        }
      }
    }

    // =========================
    // 🏆 KO-QUALIFIER ERSTELLEN
    // =========================
    const qualifierRefs = [];

    for (let g = 0; g < groups.length; g++) {
      const groupLetter = String.fromCharCode(65 + g);
      const playerCountInGroup = groups[g].players.length;
      const actualQualifiers = Math.min(qualifiedPerGroup, playerCountInGroup);

      for (let q = 1; q <= actualQualifiers; q++) {
        qualifierRefs.push(`G${groupLetter}-${q}`);
      }
    }

    if (qualifierRefs.length < 2) {
      return {
        type: "group_ko",
        groups,
        matches,
      };
    }

    // =========================
    // 🔧 KO-SLOTS ROBUST AUFBAUEN
    // =========================
    // WICHTIG:
    // Statt harter Kreuzpaarung Gruppe A/B, bei der bei Restgruppen
    // Qualifier verloren gehen konnten, nehmen wir ALLE Qualifier mit.
    let koSlots = [...qualifierRefs];

    const nextPowerOfTwo = (n) => Math.pow(2, Math.ceil(Math.log2(n)));
    const bracketSize = nextPowerOfTwo(koSlots.length);

    while (koSlots.length < bracketSize) {
      koSlots.push("__BYE__");
    }

    // Zufällig mischen, damit Freilose/Slots fair verteilt sind
    koSlots = [...koSlots].sort(() => Math.random() - 0.5);

    // =========================
    // 🎯 ERSTE KO-RUNDE
    // =========================
    let koMatchNumber = 1;
    let currentRefs = [];
    let round = 2;

    for (let i = 0; i < koSlots.length; i += 2) {
      const p1 = koSlots[i];
      const p2 = koSlots[i + 1];

      let winner = null;
      let status = "pending";

      if (p1 === "__BYE__" && p2 !== "__BYE__") {
        winner = p2;
        status = "finished";
      } else if (p2 === "__BYE__" && p1 !== "__BYE__") {
        winner = p1;
        status = "finished";
      } else if (p1 === "__BYE__" && p2 === "__BYE__") {
        continue;
      }

      matches.push({
        matchNumber: String(koMatchNumber),
        round,
        group: null,
        player1: p1,
        player2: p2,
        winner,
        status,
        boardId: null,
      });

      currentRefs.push(String(koMatchNumber));
      koMatchNumber++;
    }

    round++;

    // =========================
    // 🎯 WEITERE KO-RUNDEN
    // =========================
    while (currentRefs.length > 1) {
      const nextRefs = [];

      if (currentRefs.length % 2 !== 0) {
        currentRefs.push("__BYE__");
      }

      for (let i = 0; i < currentRefs.length; i += 2) {
        const ref1 = currentRefs[i];
        const ref2 = currentRefs[i + 1];

        if (ref1 === "__BYE__" && ref2 === "__BYE__") continue;

        let winner = null;
        let status = "pending";

        if (ref1 === "__BYE__" && ref2 !== "__BYE__") {
          winner = ref2;
          status = "finished";
        } else if (ref2 === "__BYE__" && ref1 !== "__BYE__") {
          winner = ref1;
          status = "finished";
        }

        matches.push({
          matchNumber: String(koMatchNumber),
          round,
          group: null,
          player1: ref1,
          player2: ref2,
          winner,
          status,
          boardId: null,
        });

        nextRefs.push(String(koMatchNumber));
        koMatchNumber++;
      }

      currentRefs = nextRefs;
      round++;
    }

    return {
      type: "group_ko",
      groups,
      matches,
    };
  }

  generateKOTournament(players) {
    if (!Array.isArray(players) || players.length < 2) {
      throw new Error("Mindestens 2 Spieler nötig");
    }

    const matches = [];
    const rounds = [];

    const nextPowerOfTwo = (n) => Math.pow(2, Math.ceil(Math.log2(n)));
    const bracketSize = nextPowerOfTwo(players.length);
    const byes = bracketSize - players.length;

    const createBye = () => ({
      type: "bye",
      name: "Freilos",
    });

    const shuffleArray = (arr) => [...arr].sort(() => Math.random() - 0.5);

    // Spieler mischen
    const shuffledPlayers = shuffleArray(players);

    // Spieler + Freilose gemeinsam mischen, damit die Freilose zufällig verteilt sind
    const firstRoundPlayers = shuffleArray([
      ...shuffledPlayers,
      ...Array.from({ length: byes }, () => createBye()),
    ]);

    let matchNumber = 1;
    const round1 = [];

    for (let i = 0; i < firstRoundPlayers.length; i += 2) {
      const p1 = firstRoundPlayers[i];
      const p2 = firstRoundPlayers[i + 1];

      const p1IsBye = p1?.type === "bye";
      const p2IsBye = p2?.type === "bye";

      let winner = null;
      let status = "pending";

      if (p1IsBye && !p2IsBye) {
        winner = p2;
        status = "finished";
      } else if (!p1IsBye && p2IsBye) {
        winner = p1;
        status = "finished";
      } else if (p1IsBye && p2IsBye) {
        winner = createBye();
        status = "finished";
      }

      const match = {
        matchNumber: String(matchNumber),
        round: 1,
        group: null,
        player1: p1,
        player2: p2,
        winner,
        status,
        boardId: null,
      };

      round1.push(match);
      matches.push(match);
      matchNumber++;
    }

    rounds.push(round1);

    let currentRound = round1;
    let round = 2;

    while (currentRound.length > 1) {
      const nextRound = [];

      if (currentRound.length % 2 !== 0) {
        currentRound.push({
          matchNumber: "__BYE_MATCH__",
          winner: createBye(),
        });
      }

      for (let i = 0; i < currentRound.length; i += 2) {
        const m1 = currentRound[i];
        const m2 = currentRound[i + 1];

        if (!m1 || !m2) continue;

        let player1 = String(m1.matchNumber);
        let player2 = String(m2.matchNumber);

        let winner = null;
        let status = "pending";

        if (m1.matchNumber === "__BYE_MATCH__" && m2.matchNumber !== "__BYE_MATCH__") {
          player1 = createBye();
          player2 = String(m2.matchNumber);
        } else if (m2.matchNumber === "__BYE_MATCH__" && m1.matchNumber !== "__BYE_MATCH__") {
          player1 = String(m1.matchNumber);
          player2 = createBye();
        } else if (m1.matchNumber === "__BYE_MATCH__" && m2.matchNumber === "__BYE_MATCH__") {
          player1 = createBye();
          player2 = createBye();
        }

        const match = {
          matchNumber: String(matchNumber),
          round,
          group: null,
          player1,
          player2,
          winner,
          status,
          boardId: null,
        };

        nextRound.push(match);
        matches.push(match);
        matchNumber++;
      }

      rounds.push(nextRound);
      currentRound = nextRound;
      round++;
    }

    return {
      type: "ko",
      matches,
    };
  }

  async createFullTournament(
    tournamentName,
    type,
    players,
    boards,
    playersPerGroup,
    qualifiedPerGroup,
  ) {
    // 1️⃣ Turnier erstellen
    let code = Math.random().toString(36).substring(2, 8);
    const tournamentId = await this.db.createTournament(tournamentName, code, type);

    let data = {};
    let playersWithIds = [];
    let groups = [];

    // 2️⃣ Struktur generieren
    if (type == "KO") {
      playersWithIds = await this.db.createPlayers(tournamentId, players);

      await new Promise((r) => setTimeout(r, 0)); // flush event loop

      data = this.generateKOTournament(playersWithIds);
    } else {
      // 1. Gruppen erstmal aus Namen erzeugen
      const previewData = this.generateTournament(players, playersPerGroup, qualifiedPerGroup);

      // 2. Gruppen speichern
      groups = await this.db.createGroups(tournamentId, previewData.groups);

      // 3. Spieler mit IDs speichern
      playersWithIds = await this.db.createPlayersGroups(tournamentId, groups);

      // 4. Jetzt die Gruppenphase NEU mit Spielerobjekten + IDs erzeugen
      data = this.generateTournament(playersWithIds, playersPerGroup, qualifiedPerGroup);
    }

    // 5️⃣ Matches speichern
    await this.db.createMatches(tournamentId, data.matches, playersWithIds);

    // 5.1️⃣ Freilose und direkte Gewinner automatisch weitertragen
    await this.db.autoAdvanceExistingWinners(tournamentId);

    // 6️⃣ Boards hinzufügen
    if (boards) {
      await this.db.addBoards(tournamentId, boards);
    }

    return {
      id: tournamentId,
      code: code,
      data: data,
      players: playersWithIds,
    };
  }
}