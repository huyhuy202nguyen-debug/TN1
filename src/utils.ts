import { Question } from "./types";

export const parseAzotaTextLocally = (text: string, defaultCategory: string): Question[] => {
  const questions: Question[] = [];
  
  const questionBlocks = text.split(/(?=(?:Câu|Bài|Question)\s*\d+[:.])/i).filter(b => b.trim());

  questionBlocks.forEach((block) => {
    const lines = block.split('\n').map(l => l.trim()).filter(l => l.length > 0);
    
    const hasTFOptions = lines.some(l => /^(\*?)[a-d][\.\)]\s*(?:\[.*?\])?/.test(l));
    const hasMCOptions = lines.some(l => /^(\*?)[A-Z][\.\)]\s+/.test(l));
    
    const isTFCluster = hasTFOptions && !hasMCOptions;

    let qType: Question["questionType"] = "single";
    let qTextLines: string[] = [];
    let optionsMap: Record<string, string> = {};
    let correctAnswers: string[] = [];
    let explanationLines: string[] = [];
    
    let isParsingExplanation = false;

    if (isTFCluster) {
      let mainText = "";
      let currentStatements: { id: string, text: string, isTrue: boolean }[] = [];
      
      lines.forEach(line => {
        const tfMatch = line.match(/^(\*?)([a-d])[\.\)]\s*(?:\[.*?\])?\s*(.+)$/);
        if (tfMatch) {
          const isTrue = tfMatch[1] === '*';
          const letter = tfMatch[2].toLowerCase();
          const statementText = tfMatch[3].trim();
          currentStatements.push({ id: letter, text: statementText, isTrue });
        } else if (line.match(/^(?:\[Đáp án:|Đáp án:|=> Đáp án:|Đáp án)\s*(.+?)]?$/i)) {
          // Explicit answers can be ignored for TF if * is used
        } else if (line.match(/^(?:Giải thích:|HDG:|Hướng dẫn giải:|HD:)\s*(.*)$/i)) {
          isParsingExplanation = true;
          explanationLines.push(line.replace(/^(?:Giải thích:|HDG:|Hướng dẫn giải:|HD:)\s*/i, ''));
        } else {
          if (isParsingExplanation) {
            explanationLines.push(line);
          } else if (currentStatements.length === 0) {
            if (!/^PHẦN\s+[IVX]+|^Phần\s+\d+/i.test(line)) {
               const qMatch = line.match(/^(?:Câu|Bài|Question)\s*\d+[:.]\s*(.*)$/i);
               if (qMatch) {
                 if (qMatch[1].trim()) qTextLines.push(qMatch[1].trim());
               } else {
                 qTextLines.push(line);
               }
            }
          }
        }
      });

      mainText = qTextLines.join('\n').trim();
      const explanation = explanationLines.join('\n').trim();

      const options = currentStatements.map(stmt => `Phát biểu ${stmt.id.toUpperCase()}: ${stmt.text}`);
      const correctAnswersList = currentStatements.map(stmt => stmt.isTrue ? "Đúng" : "Sai");

      questions.push({
        id: "",
        questionText: mainText,
        questionType: "true_false_cluster",
        options: options,
        correctAnswers: correctAnswersList,
        explanation: explanation || "Chưa có lời giải thích.",
        category: defaultCategory || "Chung",
        difficulty: "medium",
      });
      
      return; 
    }

    for (let i = 0; i < lines.length; i++) {
      let line = lines[i];

      if (/^PHẦN\s+[IVX]+|^Phần\s+\d+/i.test(line)) continue;

      const answerMatch = line.match(/^(?:\[Đáp án:|Đáp án:|=> Đáp án:|Đáp án)\s*(.+?)]?$/i);
      if (answerMatch) {
        const ansStr = answerMatch[1].trim();
        correctAnswers.push(...ansStr.split(/[,;\s]+/).map(a => a.trim()).filter(a => a));
        isParsingExplanation = true;
        continue;
      }

      const explainMatch = line.match(/^(?:Giải thích:|HDG:|Hướng dẫn giải:|HD:)\s*(.*)$/i);
      if (explainMatch) {
        isParsingExplanation = true;
        if (explainMatch[1].trim()) explanationLines.push(explainMatch[1].trim());
        continue;
      }

      if (isParsingExplanation) {
        explanationLines.push(line);
        continue;
      }

      if (/(?:^|\s+)(\*?[A-Z])[\.\)]\s/.test(line)) {
         const optMatches = Array.from(line.matchAll(/(?:^|\s+)(\*?[A-Z])[\.\)]\s+(.*?)(?=\s+\*?[A-Z][\.\)]\s+|$)/g));
         let matchedAnything = false;
         optMatches.forEach(m => {
           let marker = m[1].toUpperCase();
           let isCorrect = marker.startsWith('*');
           let letter = marker.replace('*', '');
           let optText = m[2].trim();
           optionsMap[letter] = optText;
           if (isCorrect) correctAnswers.push(letter);
           matchedAnything = true;
         });
         if (matchedAnything) continue; 
      }

      if (i === 0) {
        const qMatch = line.match(/^(?:Câu|Bài|Question)\s*\d+[:.]\s*(.*)$/i);
        if (qMatch) {
          if (qMatch[1].trim()) qTextLines.push(qMatch[1].trim());
        } else {
          qTextLines.push(line);
        }
      } else {
        qTextLines.push(line);
      }
    }

    const qText = qTextLines.join('\n').trim();
    const optionLetters = Object.keys(optionsMap).sort();
    const options = optionLetters.map(l => optionsMap[l]);
    
    let finalCorrectAnswers = correctAnswers.map(ansLetter => {
       return optionsMap[ansLetter.toUpperCase()] || ansLetter;
    });

    if (options.length === 0) {
      qType = "short_answer";
    } else {
      if (options.length === 2 && (options.includes("Đúng") || options.includes("True")) && (options.includes("Sai") || options.includes("False"))) {
        qType = "true_false";
      } else if (finalCorrectAnswers.length > 1) {
        qType = "multiple";
      } else {
        qType = "single";
      }
    }

    if (finalCorrectAnswers.length === 0 && options.length > 0) {
      finalCorrectAnswers = [options[0]];
    }

    if (qText || options.length > 0) {
      // Don't push empty/junk blocks that didn't parse anything meaningful
      if (!qText && options.length === 0) return;

      questions.push({
        id: "", 
        questionText: qText || "Câu hỏi không có nội dung",
        questionType: qType,
        options: options,
        correctAnswers: finalCorrectAnswers,
        explanation: explanationLines.join('\n').trim() || "Chưa có lời giải thích.",
        category: defaultCategory || "Chung",
        difficulty: "medium",
      });
    }
  });

  return questions;
};
