import React, { useState, useEffect, useRef } from 'react';

// --- DEDICATED CODE PANE COMPONENT ---
const CodePane = ({ text, side, isPlaceholder, isAdded, isRemoved, isModified, onChange, onMergeBlock, onMergeLine }) => {
  const [isEditing, setIsEditing] = useState(false);

  let bgColor = side === 'A' ? 
    (isRemoved ? 'bg-red-900/30 text-red-200' : isModified ? 'bg-yellow-900/20 text-yellow-100' : isAdded ? 'text-gray-500 italic bg-[#1e1e1e]' : 'text-[#d4d4d4]') 
    : 
    (isAdded ? 'bg-green-900/30 text-green-200' : isModified ? 'bg-yellow-900/30 text-yellow-200' : isRemoved ? 'text-gray-500 italic bg-[#1e1e1e]' : 'text-[#d4d4d4]');

  if (isEditing && !isPlaceholder) {
    return (
      <div 
        className={`w-full min-w-0 px-4 py-2 outline-none focus:bg-[#062f4a] ${bgColor} whitespace-pre-wrap break-all border border-blue-500`}
        contentEditable={true}
        suppressContentEditableWarning={true}
        onBlur={(e) => {
          setIsEditing(false);
          onChange(e.target.innerText);
        }}
        ref={el => {
          if (el && document.activeElement !== el) {
            el.focus();
            const selection = window.getSelection();
            const range = document.createRange();
            range.selectNodeContents(el);
            range.collapse(false);
            selection.removeAllRanges();
            selection.addRange(range);
          }
        }}
      >
        {text}
      </div>
    );
  }

  return (
    <div 
      className={`w-full min-w-0 px-4 py-2 relative group ${!isPlaceholder ? 'cursor-text' : ''} ${bgColor}`}
      onClick={() => { if (!isPlaceholder) setIsEditing(true); }}
    >
      {isPlaceholder ? (
         <div className="whitespace-pre-wrap break-all">{text}</div>
      ) : (
        <div className="font-mono flex flex-col">
          {text.split('\n').map((line, idx) => (
            <div key={idx} className="group/line flex items-start hover:bg-white/10 relative -mx-2 px-2 rounded transition-colors">
              <div className="flex-1 whitespace-pre-wrap break-all">{line}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};


// --- MAIN APP COMPONENT ---
const PermissionSetDiff = () => {
  const [fileA, setFileA] = useState(null);
  const [fileB, setFileB] = useState(null);
  const [modeA, setModeA] = useState('upload'); 
  const [modeB, setModeB] = useState('upload'); 
  const [pasteA, setPasteA] = useState('');
  const [pasteB, setPasteB] = useState('');
  
  const [diffResults, setDiffResults] = useState([]);
  const [showUnchanged, setShowUnchanged] = useState(false);
  const [editingBlock, setEditingBlock] = useState({ idx: null, side: null });

  const historyRef = useRef([]);
  const currentDiffRef = useRef([]);

  useEffect(() => {
    currentDiffRef.current = diffResults;
  }, [diffResults]);

  const saveToHistory = () => {
    historyRef.current.push(JSON.parse(JSON.stringify(currentDiffRef.current)));
  };

  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
        if (document.activeElement.tagName === 'TEXTAREA' || document.activeElement.tagName === 'INPUT') return;
        
        if (historyRef.current.length > 0) {
          e.preventDefault();
          const previousState = historyRef.current.pop();
          setDiffResults(previousState);
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const parsePermissions = (text) => {
    const xmlDeclMatch = text.match(/<\?xml.*?\?>/);
    const xmlDecl = xmlDeclMatch ? xmlDeclMatch[0] : '<?xml version="1.0" encoding="UTF-8"?>';

    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString(text.trim(), "text/xml");
    const rootNode = xmlDoc.documentElement;
    
    const rootTagName = rootNode.tagName;
    let rootAttributes = '';
    for (let attr of rootNode.attributes) {
      rootAttributes += ` ${attr.name}="${attr.value}"`;
    }

    const parsedData = {};

    for (let i = 0; i < rootNode.children.length; i++) {
      const node = rootNode.children[i];
      const categoryName = node.tagName; 

      if (node.children.length === 0) {
        parsedData['TopLevelProperties'] = parsedData['TopLevelProperties'] || {};
        parsedData['TopLevelProperties'][categoryName] = node.textContent;
        continue;
      }

      parsedData[categoryName] = parsedData[categoryName] || {};
      let uniqueKey = null;
      const values = {};

      for (let j = 0; j < node.children.length; j++) {
        const propNode = node.children[j];
        const propName = propNode.tagName;
        const propValue = propNode.textContent;

        values[propName] = propValue;

        if (!uniqueKey && propValue !== 'true' && propValue !== 'false') {
          uniqueKey = propValue;
        }
      }

      if (uniqueKey) {
        parsedData[categoryName][uniqueKey] = values;
      }
    }
    
    return { meta: { xmlDecl, rootTagName, rootAttributes }, parsedData };
  };

  const generateDiff = (textA, textB) => {
    const parsedA = parsePermissions(textA);
    const parsedB = parsePermissions(textB);

    const mapA = parsedA.parsedData;
    const mapB = parsedB.parsedData;
    const diff = [];

    diff.push({ category: 'Root Wrapper', name: 'File Header', status: 'Unchanged', before: `${parsedA.meta.xmlDecl}\n<${parsedA.meta.rootTagName}${parsedA.meta.rootAttributes}>`, after: `${parsedB.meta.xmlDecl}\n<${parsedB.meta.rootTagName}${parsedB.meta.rootAttributes}>` });

    Object.keys(mapA).forEach(category => {
      const categoryA = mapA[category] || {};
      const categoryB = mapB[category] || {};

      if (category === 'TopLevelProperties') {
        Object.keys(categoryA).forEach(key => {
          if (categoryA[key] !== categoryB[key]) {
            diff.push({ category: 'Top-Level Setting', name: key, status: 'Modified', before: categoryA[key], after: categoryB[key] || 'Not Set' });
          } else {
            diff.push({ category: 'Top-Level Setting', name: key, status: 'Unchanged', before: categoryA[key], after: categoryB[key] });
          }
        });
        return; 
      }

      Object.keys(categoryA).forEach(key => {
        const valA = categoryA[key];
        const valB = categoryB[key];

        if (!valB) {
          diff.push({ category, name: key, status: 'Removed', before: valA, after: null });
        } else {
          const allProps = new Set([...Object.keys(valA), ...Object.keys(valB)]);
          const isModified = Array.from(allProps).some(prop => valA[prop] !== valB[prop]);
          diff.push({ category, name: key, status: isModified ? 'Modified' : 'Unchanged', before: valA, after: valB });
        }
      });
    });

    Object.keys(mapB).forEach(category => {
      const categoryA = mapA[category] || {};
      const categoryB = mapB[category] || {};

      if (category === 'TopLevelProperties') {
        Object.keys(categoryB).forEach(key => {
          if (!categoryA[key]) {
            diff.push({ category: 'Top-Level Setting', name: key, status: 'Added', before: 'Not Set', after: categoryB[key] });
          }
        });
        return;
      }

      Object.keys(categoryB).forEach(key => {
        if (!categoryA[key]) {
          diff.push({ category, name: key, status: 'Added', before: null, after: categoryB[key] });
        }
      });
    });

    diff.push({ category: 'Root Wrapper', name: 'File Footer', status: 'Unchanged', before: `</${parsedA.meta.rootTagName}>`, after: `</${parsedB.meta.rootTagName}>` });

    setDiffResults(diff);
  };

  const handleCompare = async () => {
    const textA = modeA === 'upload' ? (fileA ? await fileA.text() : '') : pasteA;
    const textB = modeB === 'upload' ? (fileB ? await fileB.text() : '') : pasteB;

    if (!textA || !textB) return alert("Please provide XML content for both A and B!");

    setPasteA(textA);
    setPasteB(textB);
    setModeA('paste');
    setModeB('paste');

    historyRef.current = [];
    generateDiff(textA, textB);
  };

  const reconstructXML = (category, keyName, valObj) => {
    if (!valObj) return '';
    if (category === 'Root Wrapper') return valObj;
    if (category === 'Top-Level Setting') return `    <${keyName}>${valObj}</${keyName}>`;

    let xml = `    <${category}>\n`;
    Object.entries(valObj).forEach(([k, v]) => {
      xml += `        <${k}>${v}</${k}>\n`;
    });
    xml += `    </${category}>`;
    return xml;
  };
  
  const applyChangeAndRecompare = (overrideLogic) => {
    saveToHistory();

    const linesFullA = [];
    const linesFullB = [];

    diffResults.forEach((result, idx) => {
      let textA = result.overrideTextA !== undefined ? result.overrideTextA : reconstructXML(result.category, result.name, result.before);
      let textB = result.overrideTextB !== undefined ? result.overrideTextB : reconstructXML(result.category, result.name, result.after);

      const overrides = overrideLogic(idx, textA, textB);
      if (overrides) {
        textA = overrides.textA;
        textB = overrides.textB;
      }

      if (textA && textA !== '') linesFullA.push(textA);
      if (textB && textB !== '') linesFullB.push(textB);
    });

    const newFullA = linesFullA.join('\n');
    const newFullB = linesFullB.join('\n');
    setPasteA(newFullA);
    setPasteB(newFullB);
    generateDiff(newFullA, newFullB);
  };

  const handleMergeBlock = (globalIdx, direction) => {
    applyChangeAndRecompare((idx, textA, textB) => {
      if (idx === globalIdx) {
        return direction === 'AtoB' ? { textA, textB: textA } : { textA: textB, textB };
      }
      return null;
    });
  };

  const handleMergeLine = (globalIdx, lineIdx, direction) => {
    applyChangeAndRecompare((idx, textA, textB) => {
      if (idx === globalIdx) {
        let arrA = textA ? textA.split('\n') : [];
        let arrB = textB ? textB.split('\n') : [];
        
        const maxLen = Math.max(arrA.length, arrB.length);
        while(arrA.length < maxLen) arrA.push('');
        while(arrB.length < maxLen) arrB.push('');

        if (direction === 'AtoB') {
          arrB[lineIdx] = arrA[lineIdx];
          textB = arrB.filter(l => l !== undefined && l !== '').join('\n');
        } else {
          arrA[lineIdx] = arrB[lineIdx];
          textA = arrA.filter(l => l !== undefined && l !== '').join('\n');
        }
        return { textA, textB };
      }
      return null;
    });
  };

  const handleTextEdit = (globalIdx, side, newText) => {
    applyChangeAndRecompare((idx, textA, textB) => {
      if (idx === globalIdx) {
        if (side === 'A') textA = newText;
        if (side === 'B') textB = newText;
        return { textA, textB };
      }
      return null;
    });
  };

  const copyFullFile = (side) => {
    const textToCopy = side === 'A' ? pasteA : pasteB;
    navigator.clipboard.writeText(textToCopy);
    alert(`Complete File ${side} copied to clipboard!`);
  };

  const totalChanges = diffResults.filter(d => d.status !== 'Unchanged').length;
  const unchangedCount = diffResults.filter(d => d.status === 'Unchanged').length;
  const displayedResults = showUnchanged ? diffResults : diffResults.filter(r => r.status !== 'Unchanged');

  return (
    <div className="min-h-screen bg-[#111111] p-4 md:p-8 font-sans text-[#d4d4d4]">
      <div className="max-w-[100%] mx-auto bg-[#1e1e1e] rounded-xl shadow-2xl overflow-hidden flex flex-col border border-gray-800">
        
        {/* HEADER */}
        <div className="bg-[#252526] p-4 md:p-6 text-white text-center flex justify-center items-center gap-4 border-b border-gray-800">
          <h1 className="text-xl md:text-2xl font-bold tracking-wide">Salesforce XML Merge Engine</h1>
          <span className="bg-[#1e1e1e] px-3 py-1 text-xs rounded-full border border-gray-700 text-gray-300 shadow-inner">Ctrl + Z to Undo</span>
        </div>

        {/* UPLOAD SECTION */}
        <div className="p-4 md:p-8 flex flex-col md:flex-row gap-6 justify-center bg-[#1e1e1e]">
          {/* Box A */}
          <div className="w-full md:w-1/2 bg-[#252526] p-5 rounded-lg border border-gray-700 shadow-lg flex flex-col">
            <div className="flex justify-between items-center mb-4 border-b border-gray-700 pb-3">
              <h3 className="text-lg font-semibold text-gray-200">Original (A)</h3>
              <div className="flex bg-[#1e1e1e] p-1 rounded border border-gray-700">
                <button onClick={() => setModeA('upload')} className={`px-3 py-1 text-xs md:text-sm rounded transition-all ${modeA === 'upload' ? 'bg-blue-600 shadow text-white font-bold' : 'text-gray-400 hover:text-white'}`}>Upload</button>
                <button onClick={() => setModeA('paste')} className={`px-3 py-1 text-xs md:text-sm rounded transition-all ${modeA === 'paste' ? 'bg-blue-600 shadow text-white font-bold' : 'text-gray-400 hover:text-white'}`}>Paste</button>
              </div>
            </div>
            {modeA === 'upload' ? (
              <div className="flex items-center gap-4 bg-[#1e1e1e] p-3 rounded border border-gray-700">
                <label className="cursor-pointer bg-[#333333] hover:bg-[#444444] text-gray-200 font-semibold py-2 px-4 rounded transition border border-gray-600 text-sm shadow">
                  Choose File
                  <input type="file" accept=".xml" onChange={(e) => setFileA(e.target.files[0])} className="hidden" />
                </label>
                <span className="text-sm font-mono text-gray-400 truncate flex-1">{fileA ? fileA.name : "No file chosen..."}</span>
              </div>
            ) : (
              <textarea className="w-full h-32 p-3 border border-gray-700 rounded bg-[#1e1e1e] text-xs font-mono text-[#d4d4d4] resize-y outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-colors placeholder-gray-600" placeholder="Paste original XML here..." value={pasteA} onChange={(e) => setPasteA(e.target.value)} />
            )}
          </div>
          
          {/* Box B */}
          <div className="w-full md:w-1/2 bg-[#252526] p-5 rounded-lg border border-gray-700 shadow-lg flex flex-col">
            <div className="flex justify-between items-center mb-4 border-b border-gray-700 pb-3">
              <h3 className="text-lg font-semibold text-gray-200">Modified (B)</h3>
              <div className="flex bg-[#1e1e1e] p-1 rounded border border-gray-700">
                <button onClick={() => setModeB('upload')} className={`px-3 py-1 text-xs md:text-sm rounded transition-all ${modeB === 'upload' ? 'bg-blue-600 shadow text-white font-bold' : 'text-gray-400 hover:text-white'}`}>Upload</button>
                <button onClick={() => setModeB('paste')} className={`px-3 py-1 text-xs md:text-sm rounded transition-all ${modeB === 'paste' ? 'bg-blue-600 shadow text-white font-bold' : 'text-gray-400 hover:text-white'}`}>Paste</button>
              </div>
            </div>
            {modeB === 'upload' ? (
              <div className="flex items-center gap-4 bg-[#1e1e1e] p-3 rounded border border-gray-700">
                <label className="cursor-pointer bg-[#333333] hover:bg-[#444444] text-gray-200 font-semibold py-2 px-4 rounded transition border border-gray-600 text-sm shadow">
                  Choose File
                  <input type="file" accept=".xml" onChange={(e) => setFileB(e.target.files[0])} className="hidden" />
                </label>
                <span className="text-sm font-mono text-gray-400 truncate flex-1">{fileB ? fileB.name : "No file chosen..."}</span>
              </div>
            ) : (
              <textarea className="w-full h-32 p-3 border border-gray-700 rounded bg-[#1e1e1e] text-xs font-mono text-[#d4d4d4] resize-y outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-colors placeholder-gray-600" placeholder="Paste modified XML here..." value={pasteB} onChange={(e) => setPasteB(e.target.value)} />
            )}
          </div>
        </div>

        {/* COMPARE BUTTON */}
        <div className="text-center bg-[#1e1e1e] pb-8 border-b border-gray-800">
          <button onClick={handleCompare} className="bg-blue-600 hover:bg-blue-500 text-white font-bold py-3 px-12 rounded transition shadow-lg text-lg border border-blue-500 tracking-wide">
            Compare & Merge
          </button>
        </div>

        {/* DIFF VIEWER */}
        {diffResults.length > 0 && (
          <div className="flex flex-col flex-1 bg-[#1e1e1e]">
            <div className="flex justify-between items-center p-4 bg-[#252526] border-b border-gray-700">
              <h2 className="text-lg font-bold text-gray-200">{totalChanges} Conflicts Left</h2>
              <label className="flex items-center space-x-2 cursor-pointer bg-[#1e1e1e] border border-gray-700 px-3 py-1.5 rounded hover:bg-gray-800 transition">
                <input type="checkbox" checked={showUnchanged} onChange={() => setShowUnchanged(!showUnchanged)} className="w-4 h-4 rounded accent-blue-600 bg-gray-800 border-gray-600" />
                <span className="font-medium text-sm text-gray-300">Show Context ({unchangedCount})</span>
              </label>
            </div>

            <div className="bg-[#1e1e1e] text-[#d4d4d4] font-mono text-sm flex flex-col">
              
              <div className="flex sticky top-0 bg-[#252526] border-b border-gray-700 text-xs text-gray-400 z-20 shadow-lg">
                <div className="w-[46%] p-3 border-r border-gray-700 flex justify-between items-center">
                  <span className="uppercase font-bold tracking-wider text-gray-300">File A (Original)</span>
                  <button onClick={() => copyFullFile('A')} className="bg-[#333333] hover:bg-[#444444] border border-gray-600 text-white px-3 py-1 rounded transition">Copy A</button>
                </div>
                <div className="w-[8%] border-r border-gray-700 text-center py-3 uppercase font-bold text-[10px] tracking-widest text-gray-500 bg-[#1e1e1e]">Merge</div>
                <div className="w-[46%] p-3 flex justify-between items-center">
                  <span className="uppercase font-bold tracking-wider text-gray-300">File B (Modified)</span>
                  <button onClick={() => copyFullFile('B')} className="bg-[#333333] hover:bg-[#444444] border border-gray-600 text-white px-3 py-1 rounded transition">Copy B</button>
                </div>
              </div>

              <div className="flex flex-col pb-10">
                {displayedResults.map((result, idx) => {
                  const globalIdx = diffResults.indexOf(result);
                  const isAdded = result.status === 'Added';
                  const isRemoved = result.status === 'Removed';
                  const isModified = result.status === 'Modified';
                  const isUnchanged = result.status === 'Unchanged';

                  const textA = result.overrideTextA !== undefined ? result.overrideTextA : reconstructXML(result.category, result.name, result.before);
                  const textB = result.overrideTextB !== undefined ? result.overrideTextB : reconstructXML(result.category, result.name, result.after);
                  
                  const linesA = isAdded ? [''] : textA.split('\n');
                  const linesB = isRemoved ? [''] : textB.split('\n');
                  const maxLines = Math.max(linesA.length, linesB.length);
                  
                  const renderA = [...linesA];
                  const renderB = [...linesB];
                  while(renderA.length < maxLines) renderA.push('');
                  while(renderB.length < maxLines) renderB.push('');

                  const bgA = isRemoved ? 'bg-red-950/40 text-red-200' : isModified ? 'bg-yellow-950/30 text-yellow-100' : isAdded ? 'text-gray-600 italic' : 'text-[#d4d4d4]';
                  const bgB = isAdded ? 'bg-green-950/30 text-green-200' : isModified ? 'bg-yellow-950/30 text-yellow-200' : isRemoved ? 'text-gray-600 italic' : 'text-[#d4d4d4]';

                  return (
                    <div key={globalIdx} className="flex flex-col w-full border-b border-gray-800/80">
                      
                      {!isUnchanged && result.category !== 'Root Wrapper' && (
                        <div className="flex w-full bg-[#1e1e1e] border-b border-gray-800 text-[10px] text-gray-500 uppercase tracking-widest">
                            <div className="w-[46%] px-4 py-1 border-r border-gray-800 text-right">
                                <button onClick={() => handleMergeBlock(globalIdx, 'AtoB')} className="hover:text-green-400 font-bold px-2 py-0.5 rounded hover:bg-gray-800 transition">Push Block ➔</button>
                            </div>
                            <div className="w-[8%] border-r border-gray-800 bg-[#252526]"></div>
                            <div className="w-[46%] px-4 py-1">
                                <button onClick={() => handleMergeBlock(globalIdx, 'BtoA')} className="hover:text-blue-400 font-bold px-2 py-0.5 rounded hover:bg-gray-800 transition">⬅ Pull Block</button>
                            </div>
                        </div>
                      )}

                      {editingBlock.idx === globalIdx ? (
                        <div className="flex w-full">
                           <div className={`w-[46%] border-r border-gray-700 ${bgA}`}>
                             {editingBlock.side === 'A' && !isAdded ? (
                                <textarea autoFocus className="w-full h-full min-h-[60px] bg-[#062f4a] text-[#d4d4d4] outline-none resize-y p-2 font-mono text-sm border border-blue-500" defaultValue={textA} onBlur={(e) => { setEditingBlock({ idx: null, side: null }); handleTextEdit(globalIdx, 'A', e.target.value); }}/>
                             ) : (
                                <div className="p-2 whitespace-pre-wrap break-all">{textA}</div>
                             )}
                           </div>
                           <div className="w-[8%] bg-[#252526] border-r border-gray-700"></div>
                           <div className={`w-[46%] ${bgB}`}>
                             {editingBlock.side === 'B' && !isRemoved ? (
                                <textarea autoFocus className="w-full h-full min-h-[60px] bg-[#062f4a] text-[#d4d4d4] outline-none resize-y p-2 font-mono text-sm border border-blue-500" defaultValue={textB} onBlur={(e) => { setEditingBlock({ idx: null, side: null }); handleTextEdit(globalIdx, 'B', e.target.value); }}/>
                             ) : (
                                <div className="p-2 whitespace-pre-wrap break-all">{textB}</div>
                             )}
                           </div>
                        </div>
                      ) : (
                        <div className="flex flex-col w-full py-2">
                          {Array.from({length: maxLines}, (_, i) => {
                             const showRight = renderA[i] && renderA[i] !== renderB[i] && !isAdded && !isRemoved;
                             const showLeft = renderB[i] && renderA[i] !== renderB[i] && !isAdded && !isRemoved;

                             return (
                               <div key={i} className="flex w-full hover:bg-white/5 transition-colors group min-h-[24px]">
                                 <div 
                                    className={`w-[46%] px-4 border-r border-gray-700 break-all whitespace-pre-wrap ${!isAdded ? 'cursor-text' : ''} ${bgA}`}
                                    onClick={() => { if(!isAdded) setEditingBlock({ idx: globalIdx, side: 'A' })}}
                                 >
                                    {renderA[i]}
                                 </div>
                                 
                                 <div className="w-[8%] border-r border-gray-700 bg-[#252526] flex justify-center items-start pt-0.5 gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                    {showRight && <button onClick={() => handleMergeLine(globalIdx, i, 'AtoB')} title="Push Line Right" className="text-gray-500 hover:text-green-400 font-bold px-1 rounded hover:bg-gray-800">➔</button>}
                                    {showLeft && <button onClick={() => handleMergeLine(globalIdx, i, 'BtoA')} title="Push Line Left" className="text-gray-500 hover:text-blue-400 font-bold px-1 rounded hover:bg-gray-800">⬅</button>}
                                 </div>

                                 <div 
                                    className={`w-[46%] px-4 break-all whitespace-pre-wrap ${!isRemoved ? 'cursor-text' : ''} ${bgB}`}
                                    onClick={() => { if(!isRemoved) setEditingBlock({ idx: globalIdx, side: 'B' })}}
                                 >
                                    {renderB[i]}
                                 </div>
                               </div>
                             );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default PermissionSetDiff;