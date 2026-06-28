import { Question, SubQuestion } from "./types";

export const parseAzotaTextLocally = (text: string, defaultCategory: string): Question[] => {
  const questions: Question[] = [];
  
  const questionBlocks = text.split(/(?=(?:Câu|Bài|Question)\s*\d+[:.]|Dữ kiện chung[:.]|Case Study[:.]|\[Dữ kiện\])/i).filter(b => b.trim());

  questionBlocks.forEach((block) => {
    const isCaseStudy = block.match(/^(?:Dữ kiện chung|Case Study|\[Dữ kiện\])/i);
    if (isCaseStudy) {
      const subQRegex = /(?=\[(?:Câu|Câu hỏi phụ|Câu phụ|Câu nhỏ|Câu hỏi nhỏ|Sub)\s*\d+\]|\-\s*Câu\s*\d+[:.])/gi;
      const parts = block.split(subQRegex);
      
      const mainTextHeader = parts[0];
      const mainTextLines = mainTextHeader.split('\n').map(l => l.trim()).filter(l => l.length > 0);
      if (mainTextLines.length > 0 && /^(?:Dữ kiện chung|Case Study|\[Dữ kiện\])/i.test(mainTextLines[0])) {
        mainTextLines.shift();
      }
      const mainText = mainTextLines.join('\n').trim();

      const parsedSubQuestions: SubQuestion[] = [];

      for (let j = 1; j < parts.length; j++) {
        const subBlock = parts[j];
        const subLines = subBlock.split('\n').map(l => l.trim()).filter(l => l.length > 0);
        if (subLines.length === 0) continue;

        let subQText = "";
        const firstLine = subLines[0];
        const cleanedFirstLine = firstLine.replace(/^\[(?:Câu|Câu hỏi phụ|Câu phụ|Câu nhỏ|Câu hỏi nhỏ|Sub)\s*\d+\]\s*|^\-\s*Câu\s*\d+[:.]\s*/i, '').trim();
        
        let subOptionsMap: Record<string, string> = {};
        let subCorrectAnswers: string[] = [];
        let subExplanationLines: string[] = [];
        let isSubParsingExplanation = false;
        let subQTextLines = [cleanedFirstLine];

        for (let k = 1; k < subLines.length; k++) {
          const line = subLines[k];

          const answerMatch = line.match(/^(?:\[Đáp án:|Đáp án:|=> Đáp án:|Đáp án)\s*(.+?)]?$/i);
          if (answerMatch) {
            const ansStr = answerMatch[1].trim();
            subCorrectAnswers.push(...ansStr.split(/[,;\s]+/).map(a => a.trim()).filter(a => a));
            isSubParsingExplanation = true;
            continue;
          }

          const explainMatch = line.match(/^(?:Giải thích:|HDG:|Hướng dẫn giải:|HD:)\s*(.*)$/i);
          if (explainMatch) {
            isSubParsingExplanation = true;
            if (explainMatch[1].trim()) subExplanationLines.push(explainMatch[1].trim());
            continue;
          }

          if (isSubParsingExplanation) {
            subExplanationLines.push(line);
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
              subOptionsMap[letter] = optText;
              if (isCorrect) subCorrectAnswers.push(letter);
              matchedAnything = true;
            });
            if (matchedAnything) continue;
          }

          subQTextLines.push(line);
        }

        subQText = subQTextLines.join('\n').trim();
        const subOptionLetters = Object.keys(subOptionsMap).sort();
        const subOptionsList = subOptionLetters.map(l => subOptionsMap[l]);

        let finalSubCorrectAnswers = subCorrectAnswers.map(ansLetter => {
          return subOptionsMap[ansLetter.toUpperCase()] || ansLetter;
        });

        let subQType: SubQuestion["questionType"] = "single";
        if (subOptionsList.length === 0) {
          subQType = "short_answer";
        } else {
          if (subOptionsList.length === 2 && (subOptionsList.includes("Đúng") || subOptionsList.includes("True")) && (subOptionsList.includes("Sai") || subOptionsList.includes("False"))) {
            subQType = "true_false";
          } else if (finalSubCorrectAnswers.length > 1) {
            subQType = "multiple";
          } else {
            subQType = "single";
          }
        }

        if (finalSubCorrectAnswers.length === 0 && subOptionsList.length > 0) {
          finalSubCorrectAnswers = [subOptionsList[0]];
        }

        parsedSubQuestions.push({
          id: `subq-${Date.now()}-${j}-${Math.random().toString(36).substr(2, 5)}`,
          questionText: subQText || "Câu hỏi phụ không có nội dung",
          questionType: subQType,
          options: subOptionsList,
          correctAnswers: finalSubCorrectAnswers,
          explanation: subExplanationLines.join('\n').trim() || "Chưa có lời giải thích.",
        });
      }

      questions.push({
        id: "",
        questionText: mainText || "Dữ kiện chung không có nội dung",
        questionType: "case_study",
        options: [],
        correctAnswers: [],
        explanation: "Xem giải thích ở các câu hỏi phụ.",
        category: defaultCategory || "Chung",
        difficulty: "medium",
        subQuestions: parsedSubQuestions,
      });

      return;
    }

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
