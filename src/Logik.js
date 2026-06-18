import { TournamentDB } from "./TournamentDB.js";

export class Logik {
  constructor() {
    this.db = new TournamentDB();
  }

  createBye() {
    return {
      type: "bye",
      name: "Freilos",
    };
  }

  createWinnerRef(ref) {
    return {
      type: "match",
      ref: Number(ref),
      source: "winner",
    };
  }

  createLoserRef(ref) {
    return {
      type: "match",
      ref: Number(ref),
      source: "loser",
    };
  }

  createQualifierRef(ref) {
    return {
      type: "qualifier",
      ref,
      qualifierRef: ref,
    };
  }

  nextPowerOfTwo(n) {
    return Math.pow(2, Math.ceil(Math.log2(n)));
  }

  shuffleArray(arr) {
    return [...arr].sort(() => Math.random() - 0.5);
  }

createRoundRobinSchedule(players = [], returnLegs = false) {
  const realPlayers = Array.isArray(players) ? players.filter(Boolean) : [];
  if (realPlayers.length < 2) return [];

  const needsBye = realPlayers.length % 2 !== 0;
  const rotation = [...realPlayers, ...(needsBye ? [this.createBye()] : [])];
  const rounds = [];
  const totalRounds = rotation.length - 1;
  const half = rotation.length / 2;

  for (let roundIndex = 0; roundIndex < totalRounds; roundIndex += 1) {
    const pairings = [];

    for (let i = 0; i < half; i += 1) {
      const left = rotation[i];
      const right = rotation[rotation.length - 1 - i];
      const isLeftBye = left?.type === "bye";
      const isRightBye = right?.type === "bye";
      if (isLeftBye || isRightBye) continue;

      const shouldSwap = roundIndex % 2 === 1;
      pairings.push({
        player1: shouldSwap ? right : left,
        player2: shouldSwap ? left : right,
      });
    }

    rounds.push(pairings);

    const fixed = rotation[0];
    const rotating = rotation.slice(1);
    rotating.unshift(rotating.pop());
    rotation.splice(0, rotation.length, fixed, ...rotating);
  }

  if (!returnLegs) return rounds;

  const returnRounds = rounds.map((round) =>
    round.map((pairing) => ({
      player1: pairing.player2,
      player2: pairing.player1,
    })),
  );

  return [...rounds, ...returnRounds];
}

buildRoundRobinMatches(groupPlayers = [], options = {}) {
  const {
    groupName = "Liga",
    groupLetter = "L",
    startRound = 1,
    returnLegs = false,
  } = options;

  // Separate explicit byes (added for equal group sizes) from real players.
  // The round-robin schedule runs on real players only — byes are never
  // scheduled against each other and don't participate in the rotation.
  const realGroupPlayers = groupPlayers.filter((p) => p?.type !== "bye");
  const explicitByeCount = groupPlayers.length - realGroupPlayers.length;

  const schedule = this.createRoundRobinSchedule(realGroupPlayers, returnLegs);
  let groupMatchCounter = 1;

  const realMatches = schedule.flatMap((pairings, roundIndex) =>
    pairings.map((pairing) => ({
      matchNumber: `${groupLetter}-${groupMatchCounter++}`,
      round: startRound + roundIndex,
      groupRound: startRound + roundIndex,
      group: groupName,
      player1: pairing.player1,
      player2: pairing.player2,
      winner: null,
      loser: null,
      status: "pending",
      resultSource: null,
      boardId: null,
      bracketType: "group",
      placementRangeStart: null,
      placementRangeEnd: null,
      winnerPlace: null,
      loserPlace: null,
      displayRoundName: groupName,
      placementGroupLabel: null,
    }))
  );

  // For each explicit bye, every real player gets one auto-win match.
  // These represent the rounds where a smaller group would have a sit-out.
  const byeMatches = [];
  const byeRoundStart = startRound + schedule.length;
  for (let b = 0; b < explicitByeCount; b++) {
    for (const player of realGroupPlayers) {
      const bye = this.createBye();
      byeMatches.push({
        matchNumber: `${groupLetter}-${groupMatchCounter++}`,
        round: byeRoundStart + b,
        groupRound: byeRoundStart + b,
        group: groupName,
        player1: player,
        player2: bye,
        winner: player,
        loser: bye,
        status: "finished",
        resultSource: "bye",
        boardId: null,
        bracketType: "group",
        placementRangeStart: null,
        placementRangeEnd: null,
        winnerPlace: null,
        loserPlace: null,
        displayRoundName: groupName,
        placementGroupLabel: null,
      });
    }
  }

  return [...realMatches, ...byeMatches];
}


  buildPlacementLabel(startPlace, endPlace, isFinal = false) {
    if (startPlace === 1 && endPlace === 2) return "Finale";
    if (startPlace === 3 && endPlace === 4) return "Spiel um Platz 3";
    if (startPlace === endPlace) return `Platz ${startPlace}`;
    if (endPlace - startPlace === 1 && isFinal) return `Spiel um Platz ${startPlace}`;
    return `Plätze ${startPlace}-${endPlace}`;
  }

  buildPlacementTree(slots, startPlace, endPlace, options = {}) {
    const {
      startRound = 1,
      startMatchNumber = 1,
      bracketType = "placement",
      placementGroupLabel = null,
    } = options;

    const participantCount = endPlace - startPlace + 1;

    if (!Array.isArray(slots) || slots.length !== participantCount) {
      throw new Error("Ungültige Platzierungsbaum-Konfiguration");
    }

    if (participantCount < 2 || (participantCount & (participantCount - 1)) !== 0) {
      throw new Error("Platzierungsbaum benötigt eine Zweierpotenz");
    }

    let matchNumber = startMatchNumber;
    const matches = [];

    const buildNode = (nodeSlots, rangeStart, rangeEnd, round) => {
      const size = rangeEnd - rangeStart + 1;

      if (size === 2) {
        const [p1, p2] = nodeSlots;
        const p1Bye = p1?.type === "bye";
        const p2Bye = p2?.type === "bye";

        let winner = null;
        let loser = null;
        let status = "pending";

        if (p1Bye && !p2Bye) {
          winner = p2;
          loser = p1;
          status = "finished";
        } else if (!p1Bye && p2Bye) {
          winner = p1;
          loser = p2;
          status = "finished";
        } else if (p1Bye && p2Bye) {
          winner = this.createBye();
          loser = this.createBye();
          status = "finished";
        }

        const match = {
          matchNumber: String(matchNumber++),
          round,
          group: null,
          player1: p1,
          player2: p2,
          winner,
          loser,
          status,
          boardId: null,
          bracketType,
          placementRangeStart: rangeStart,
          placementRangeEnd: rangeEnd,
          winnerPlace: rangeStart,
          loserPlace: rangeEnd,
          displayRoundName: this.buildPlacementLabel(rangeStart, rangeEnd, true),
          placementGroupLabel,
        };

        matches.push(match);
        return match;
      }

      const firstRoundMatches = [];

      for (let i = 0; i < nodeSlots.length; i += 2) {
        const p1 = nodeSlots[i];
        const p2 = nodeSlots[i + 1];
        const p1Bye = p1?.type === "bye";
        const p2Bye = p2?.type === "bye";

        let winner = null;
        let loser = null;
        let status = "pending";

        if (p1Bye && !p2Bye) {
          winner = p2;
          loser = p1;
          status = "finished";
        } else if (!p1Bye && p2Bye) {
          winner = p1;
          loser = p2;
          status = "finished";
        } else if (p1Bye && p2Bye) {
          winner = this.createBye();
          loser = this.createBye();
          status = "finished";
        }

        const match = {
          matchNumber: String(matchNumber++),
          round,
          group: null,
          player1: p1,
          player2: p2,
          winner,
          loser,
          status,
          boardId: null,
          bracketType,
          placementRangeStart: rangeStart,
          placementRangeEnd: rangeEnd,
          winnerPlace: null,
          loserPlace: null,
          displayRoundName: this.buildPlacementLabel(rangeStart, rangeEnd),
          placementGroupLabel,
        };

        matches.push(match);
        firstRoundMatches.push(match);
      }

      const halfSize = size / 2;
      const upperSlots = firstRoundMatches.map((match) => this.createWinnerRef(match.matchNumber));
      const lowerSlots = firstRoundMatches.map((match) => this.createLoserRef(match.matchNumber));

      buildNode(upperSlots, rangeStart, rangeStart + halfSize - 1, round + 1);
      buildNode(lowerSlots, rangeStart + halfSize, rangeEnd, round + 1);

      return null;
    };

    buildNode(slots, startPlace, endPlace, startRound);

    return {
      matches,
      nextMatchNumber: matchNumber,
    };
  }

  buildMainBracket(slots, options = {}) {
    const {
      startRound = 1,
      startMatchNumber = 1,
      playAllPlaces = false,
    } = options;

    if (!Array.isArray(slots) || slots.length < 2) {
      throw new Error("Mindestens 2 Slots für KO-Baum nötig");
    }

    const bracketSize = slots.length;
    if ((bracketSize & (bracketSize - 1)) !== 0) {
      throw new Error("KO-Baum benötigt eine Zweierpotenz");
    }

    let matchNumber = startMatchNumber;
    const matches = [];

    const buildNode = (nodeSlots, rangeStart, rangeEnd, round) => {
      const size = rangeEnd - rangeStart + 1;

      if (size === 2) {
        const [p1, p2] = nodeSlots;
        const p1Bye = p1?.type === "bye";
        const p2Bye = p2?.type === "bye";

        let winner = null;
        let loser = null;
        let status = "pending";

        if (p1Bye && !p2Bye) {
          winner = p2;
          loser = p1;
          status = "finished";
        } else if (!p1Bye && p2Bye) {
          winner = p1;
          loser = p2;
          status = "finished";
        } else if (p1Bye && p2Bye) {
          winner = this.createBye();
          loser = this.createBye();
          status = "finished";
        }

        const match = {
          matchNumber: String(matchNumber++),
          round,
          group: null,
          player1: p1,
          player2: p2,
          winner,
          loser,
          status,
          boardId: null,
          bracketType: "main",
          placementRangeStart: rangeStart,
          placementRangeEnd: rangeEnd,
          winnerPlace: rangeStart,
          loserPlace: rangeEnd,
          displayRoundName: this.buildPlacementLabel(rangeStart, rangeEnd, true),
          placementGroupLabel: null,
        };

        matches.push(match);
        return match;
      }

      const firstRoundMatches = [];

      for (let i = 0; i < nodeSlots.length; i += 2) {
        const p1 = nodeSlots[i];
        const p2 = nodeSlots[i + 1];
        const p1Bye = p1?.type === "bye";
        const p2Bye = p2?.type === "bye";

        let winner = null;
        let loser = null;
        let status = "pending";

        if (p1Bye && !p2Bye) {
          winner = p2;
          loser = p1;
          status = "finished";
        } else if (!p1Bye && p2Bye) {
          winner = p1;
          loser = p2;
          status = "finished";
        } else if (p1Bye && p2Bye) {
          winner = this.createBye();
          loser = this.createBye();
          status = "finished";
        }

        const match = {
          matchNumber: String(matchNumber++),
          round,
          group: null,
          player1: p1,
          player2: p2,
          winner,
          loser,
          status,
          boardId: null,
          bracketType: "main",
          placementRangeStart: rangeStart,
          placementRangeEnd: rangeEnd,
          winnerPlace: null,
          loserPlace: null,
          displayRoundName: this.buildPlacementLabel(rangeStart, rangeEnd),
          placementGroupLabel: null,
        };

        matches.push(match);
        firstRoundMatches.push(match);
      }

      const halfSize = size / 2;
      const winnerSlots = firstRoundMatches.map((match) => this.createWinnerRef(match.matchNumber));
      buildNode(winnerSlots, rangeStart, rangeStart + halfSize - 1, round + 1);

      if (playAllPlaces) {
        const loserSlots = firstRoundMatches.map((match) => this.createLoserRef(match.matchNumber));
        const placementResult = this.buildPlacementTree(
          loserSlots,
          rangeStart + halfSize,
          rangeEnd,
          {
            startRound: round + 1,
            startMatchNumber: matchNumber,
            bracketType: "placement",
            placementGroupLabel: this.buildPlacementLabel(rangeStart + halfSize, rangeEnd),
          },
        );

        matches.push(...placementResult.matches);
        matchNumber = placementResult.nextMatchNumber;
      }

      return null;
    };

    buildNode(slots, 1, bracketSize, startRound);

    return {
      matches,
      nextMatchNumber: matchNumber,
    };
  }
  distributeSlotsAvoidingDoubleByes(entries = []) {
    const realPlayers = this.shuffleArray(entries.filter((entry) => entry?.type !== "bye"));
    const byes = entries.filter((entry) => entry?.type === "bye");

    if (byes.length === 0) return realPlayers;
    if (realPlayers.length === 0) return byes;

    const totalSlots = realPlayers.length + byes.length;
    const result = new Array(totalSlots).fill(null);

    let playerIndex = 0;
    for (let i = 0; i < totalSlots; i += 2) {
      if (playerIndex < realPlayers.length) {
        result[i] = realPlayers[playerIndex++];
      }
    }

    for (let i = 1; i < totalSlots; i += 2) {
      if (playerIndex < realPlayers.length) {
        result[i] = realPlayers[playerIndex++];
      }
    }

    let byeIndex = 0;
    for (let i = 0; i < totalSlots && byeIndex < byes.length; i++) {
      if (result[i]) continue;

      const left = i > 0 ? result[i - 1] : null;
      const right = i < totalSlots - 1 ? result[i + 1] : null;

      const leftIsBye = left?.type === "bye";
      const rightIsBye = right?.type === "bye";

      if (!leftIsBye && !rightIsBye) {
        result[i] = byes[byeIndex++];
      }
    }

    for (let i = 0; i < totalSlots && byeIndex < byes.length; i++) {
      if (!result[i]) {
        result[i] = byes[byeIndex++];
      }
    }

    return result;
  }

  parseQualifierRef(ref = "") {
    const match = String(ref || "").match(/^G([A-Z]+)-(\d+)$/i);
    if (!match) {
      return {
        groupLetter: null,
        rank: Number.MAX_SAFE_INTEGER,
      };
    }

    return {
      groupLetter: String(match[1] || "").toUpperCase(),
      rank: Number(match[2] || 0),
    };
  }

  buildGroupKoSlots(groups = [], qualifiedPerGroup = 2) {
    const qualifiers = [];

    for (let g = 0; g < groups.length; g++) {
      const groupLetter = String.fromCharCode(65 + g);
      // Count only real players — byes added for equal group sizes must not qualify
      const realPlayerCount = (groups[g]?.players || []).filter(
        (p) => p?.type === "player"
      ).length;
      const actualQualifiers = Math.min(qualifiedPerGroup, realPlayerCount);

      for (let q = 1; q <= actualQualifiers; q++) {
        qualifiers.push({
          ...this.parseQualifierRef(`G${groupLetter}-${q}`),
          slot: this.createQualifierRef(`G${groupLetter}-${q}`),
        });
      }
    }

    if (qualifiers.length < 2) {
      return qualifiers.map((entry) => entry.slot);
    }

    qualifiers.sort((a, b) => {
      if (a.rank !== b.rank) return a.rank - b.rank;
      return String(a.groupLetter || "").localeCompare(String(b.groupLetter || ""), "de");
    });

    const bracketSize = this.nextPowerOfTwo(qualifiers.length);
    const byeCount = bracketSize - qualifiers.length;
    const byeSeeds = qualifiers.slice(0, byeCount);
    const remaining = qualifiers.slice(byeCount);
    const playedPairs = [];

    while (remaining.length > 0) {
      const first = remaining.shift();
      if (!first) break;

      if (remaining.length === 0) {
        playedPairs.push([first.slot, this.createBye()]);
        break;
      }

      const findLastMatchingIndex = (predicate) => {
        for (let i = remaining.length - 1; i >= 0; i--) {
          if (predicate(remaining[i])) return i;
        }
        return -1;
      };

      let opponentIndex = findLastMatchingIndex(
        (entry) => entry.groupLetter !== first.groupLetter && entry.rank !== first.rank,
      );

      if (opponentIndex === -1) {
        opponentIndex = findLastMatchingIndex((entry) => entry.groupLetter !== first.groupLetter);
      }

      if (opponentIndex === -1) {
        opponentIndex = findLastMatchingIndex((entry) => entry.rank !== first.rank);
      }

      if (opponentIndex === -1) {
        opponentIndex = remaining.length - 1;
      }

      const opponent = remaining.splice(opponentIndex, 1)[0];
      playedPairs.push([first.slot, opponent.slot]);
    }

    const byePairs = byeSeeds.map((entry) => [entry.slot, this.createBye()]);
    const totalPairs = bracketSize / 2;
    const orderedPairs = [];
    let byePairIndex = 0;
    let playedPairIndex = 0;

    while (orderedPairs.length < totalPairs) {
      if (byePairIndex < byePairs.length) {
        orderedPairs.push(byePairs[byePairIndex++]);
      }

      if (orderedPairs.length >= totalPairs) break;

      if (playedPairIndex < playedPairs.length) {
        orderedPairs.push(playedPairs[playedPairIndex++]);
      } else if (byePairIndex < byePairs.length) {
        orderedPairs.push(byePairs[byePairIndex++]);
      }
    }

    while (orderedPairs.length < totalPairs) {
      orderedPairs.push([this.createBye(), this.createBye()]);
    }

    return orderedPairs.flat();
  }


  buildGroupRoundRobinFromExistingGroups(groups = [], options = {}) {
    const includeReturnLegs = !!options.groupReturnLegs;
    const matches = [];

    for (let g = 0; g < groups.length; g += 1) {
      const group = groups[g] || {};
      const groupLetter = String.fromCharCode(65 + g);
      const groupName = group.name || `Gruppe ${groupLetter}`;
      const groupPlayers = Array.isArray(group.players) ? group.players.filter(Boolean) : [];

      matches.push(
        ...this.buildRoundRobinMatches(groupPlayers, {
          groupName,
          groupLetter,
          startRound: 1,
          returnLegs: includeReturnLegs,
        }),
      );
    }

    return matches;
  }

  generateTournamentFromGroups(groups = [], qualifiedPerGroup = 2, options = {}) {
    if (!Array.isArray(groups) || groups.length === 0) {
      throw new Error("Mindestens eine Gruppe nötig");
    }

    const matches = this.buildGroupRoundRobinFromExistingGroups(groups, options);
    const qualifierRefs = this.buildGroupKoSlots(groups, qualifiedPerGroup);

    if (qualifierRefs.length < 2) {
      return {
        type: "group_ko",
        groups,
        matches,
      };
    }

    const bracket = this.buildMainBracket(qualifierRefs, {
      startRound: Math.max(2, ...matches.map((match) => (Number(match.round) || 1) + 1)),
      startMatchNumber: 1,
      playAllPlaces: !!options.playAllPlaces,
    });

    return {
      type: "group_ko",
      groups,
      matches: [...matches, ...bracket.matches],
    };
  }

  generateLeagueTournamentFromPlayers(players = [], options = {}) {
    if (!Array.isArray(players) || players.length < 2) {
      throw new Error("Mindestens 2 Spieler nötig");
    }

    const groupName = "Liga";

    return {
      type: "league",
      groups: [{ name: groupName, players }],
      matches: this.buildRoundRobinMatches(players, {
        groupName,
        groupLetter: "L",
        startRound: 1,
        returnLegs: !!options.leagueReturnLegs,
      }),
    };
  }

generateTournament(players, playersPerGroup = 4, qualifiedPerGroup = 2, options = {}) {
  if (!Array.isArray(players) || players.length < 2) {
    throw new Error("Mindestens 2 Spieler nötig");
  }

  const basePlayers = options.shufflePlayers === false ? [...players] : this.shuffleArray(players);
  const groups = [];

  if (options.allPlayersOneGroup) {
    // Single group: all players play each other, top N qualify for KO
    groups.push({ name: "Gruppe A", players: basePlayers });
  } else {
    const numGroups = Math.ceil(basePlayers.length / playersPerGroup);

    for (let g = 0; g < numGroups; g += 1) {
      const start = g * playersPerGroup;
      const end   = start + playersPerGroup;
      const groupLetter = String.fromCharCode(65 + g);
      const groupPlayers = basePlayers.slice(start, end);

      // Pad the last (smaller) group with byes so all groups are equal size
      if (options.groupPhaseByes && groupPlayers.length < playersPerGroup) {
        const needed = playersPerGroup - groupPlayers.length;
        for (let i = 0; i < needed; i++) groupPlayers.push(this.createBye());
      }

      groups.push({ name: `Gruppe ${groupLetter}`, players: groupPlayers });
    }
  }

  return this.generateTournamentFromGroups(groups, qualifiedPerGroup, options);
}

generateKOTournament(players, options = {}) {
  if (!Array.isArray(players) || players.length < 2) {
    throw new Error("Mindestens 2 Spieler nötig");
  }

  const bracketSize = this.nextPowerOfTwo(players.length);
  const byes = Math.max(0, bracketSize - players.length);
  const firstRoundPlayers = this.distributeSlotsAvoidingDoubleByes([
    ...players,
    ...Array.from({ length: byes }, () => this.createBye()),
  ]);

  const bracket = this.buildMainBracket(firstRoundPlayers, {
    startRound: 1,
    startMatchNumber: 1,
    playAllPlaces: !!options.playAllPlaces,
  });

  return {
    type: "ko",
    matches: bracket.matches,
  };
}

generateLeagueTournament(players, options = {}) {
  if (!Array.isArray(players) || players.length < 2) {
    throw new Error("Mindestens 2 Spieler nötig");
  }

  const orderedPlayers = options.shufflePlayers === false ? [...players] : this.shuffleArray(players);
  return this.generateLeagueTournamentFromPlayers(orderedPlayers, options);
}

async createFullTournament(

    tournamentName,
    type,
    players,
    boards,
    playersPerGroup,
    qualifiedPerGroup,
    settings = {},
  ) {
    let code = Math.random().toString(36).substring(2, 8);
    const tournamentId = await this.db.createTournament(tournamentName, code, type, settings);

    let data = {};
    let playersWithIds = [];
    let groups = [];

    if (type === "KO") {
      playersWithIds = await this.db.createPlayers(tournamentId, players, settings);
      await new Promise((r) => setTimeout(r, 0));
      data = this.generateKOTournament(playersWithIds, settings);
    } else if (type === "LEAGUE") {
      groups = await this.db.createGroups(tournamentId, [{ name: "Liga", players }]);
      playersWithIds = await this.db.createPlayersGroups(tournamentId, groups, settings);
      data = this.generateLeagueTournamentFromPlayers(playersWithIds, { ...settings, shufflePlayers: false });
    } else {
      const previewData = this.generateTournament(players, playersPerGroup, qualifiedPerGroup, settings);
      groups = await this.db.createGroups(tournamentId, previewData.groups);
      playersWithIds = await this.db.createPlayersGroups(tournamentId, groups, settings);
      const groupsWithPlayers = groups.map((group) => ({
        ...group,
        players: playersWithIds.filter((player) => player.groupId === group.id),
      }));
      data = this.generateTournamentFromGroups(groupsWithPlayers, qualifiedPerGroup, {
        ...settings,
        shufflePlayers: false,
      });
    }

    await this.db.createMatches(tournamentId, data.matches, playersWithIds);
    await this.db.autoAdvanceExistingWinners(tournamentId);

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
