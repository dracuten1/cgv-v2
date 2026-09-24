package kinship

import (
	"container/heap"
	"context"
	"fmt"
	"sync"

	"github.com/dracuten1/cgv-v2/api/internal/model"
)

// KinshipGraphLoader defines the port for loading graph data from database or mock.
type KinshipGraphLoader interface {
	LoadGraph(ctx context.Context, familyID string) (
		members []model.Member,
		pc []model.ParentChild,
		sp []model.Spouse,
		version int64,
		err error,
	)
}

type cacheKey struct {
	familyID string
	version  int64
}

// Engine manages graph caching and runs kinship calculations.
type Engine struct {
	loader  KinshipGraphLoader
	cache   map[cacheKey]*Graph
	mu      sync.RWMutex
	lexicon *LexiconStore
}

// NewEngine creates a new kinship Engine.
func NewEngine(loader KinshipGraphLoader) *Engine {
	return &Engine{
		loader:  loader,
		cache:   make(map[cacheKey]*Graph),
		lexicon: globalLexicon,
	}
}

// Invalidate removes all cached graphs for a familyID.
func (e *Engine) Invalidate(familyID string) {
	e.mu.Lock()
	defer e.mu.Unlock()
	for k := range e.cache {
		if k.familyID == familyID {
			delete(e.cache, k)
		}
	}
}

// GetGraph retrieves the graph from cache, or loads it via the loader port on miss.
func (e *Engine) GetGraph(ctx context.Context, familyID string, version int64) (*Graph, error) {
	key := cacheKey{familyID: familyID, version: version}

	e.mu.RLock()
	g, ok := e.cache[key]
	e.mu.RUnlock()
	if ok {
		return g, nil
	}

	e.mu.Lock()
	defer e.mu.Unlock()

	// Double-check under write lock
	if g, ok := e.cache[key]; ok {
		return g, nil
	}

	if e.loader == nil {
		return nil, fmt.Errorf("không có loader để tải đồ thị dòng họ %s", familyID)
	}

	members, pc, sp, loadedVersion, err := e.loader.LoadGraph(ctx, familyID)
	if err != nil {
		return nil, fmt.Errorf("không thể tải đồ thị dòng họ %s: %w", familyID, err)
	}

	newG := NewGraph(familyID, loadedVersion, members, pc, sp)
	e.cache[cacheKey{familyID: familyID, version: loadedVersion}] = newG

	return newG, nil
}

// ancestorPath stores path and distance from a node to an ancestor
type ancestorPath struct {
	ancestorID string
	distance   int
	path       []string // [start, ..., ancestor]
}

// Calculate determines the kinship relationship between fromID and toID in graph g.
func (e *Engine) Calculate(g *Graph, fromID, toID string, dialect string) (model.KinshipResult, error) {
	dialect = NormalizeDialect(dialect)

	fromNode, ok := g.Nodes[fromID]
	if !ok {
		return model.KinshipResult{}, fmt.Errorf("không tìm thấy thành viên bắt đầu: %s", fromID)
	}
	toNode, ok := g.Nodes[toID]
	if !ok {
		return model.KinshipResult{}, fmt.Errorf("không tìm thấy thành viên đích: %s", toID)
	}

	// Edge case 1: Same person
	if fromID == toID {
		return model.KinshipResult{
			Term:               "Bản thân",
			Line:               "Đồng tông",
			GenerationDistance: 0,
			DistanceLabel:      "Cùng thế hệ",
			IsBlood:            true,
			Dialect:            dialect,
			Path:               []string{fromID},
		}, nil
	}

	// Edge case 2: Direct Spouse
	for _, spID := range g.Spouses[fromID] {
		if spID == toID {
			term := e.lexicon.ResolveTerm(dialect, false, true, 0, false, false, toNode.Gender, 0, "")
			if term == "" {
				if toNode.Gender == model.GenderMale {
					term = "Chồng"
				} else {
					term = "Vợ"
				}
			}
			return model.KinshipResult{
				Term:               term,
				Line:               "Hôn phối",
				GenerationDistance: 0,
				DistanceLabel:      "Cùng thế hệ",
				IsBlood:            false,
				Dialect:            dialect,
				Path:               []string{fromID, toID},
			}, nil
		}
	}

	// Phase 1: Blood search (Mandatory ordering per ADR-008, depth cap 12)
	bloodPath, lcaID := e.findBloodPath(g, fromID, toID, 12)
	if len(bloodPath) > 0 {
		return e.buildKinshipResult(g, fromNode, toNode, bloodPath, lcaID, true, dialect), nil
	}

	// Phase 2: Affinal fallback (Dijkstra with blood=10, spouse=15; only for marital paths, depth cap 12)
	affinalPath := e.findDijkstraPath(g, fromID, toID, 12)
	if len(affinalPath) > 0 && e.containsSpouseEdge(g, affinalPath) {
		return e.buildKinshipResult(g, fromNode, toNode, affinalPath, "", false, dialect), nil
	}

	// Edge case 3: Disconnected or beyond depth cap
	return model.KinshipResult{
		Term:               "Không xác định được quan hệ",
		Line:               "",
		GenerationDistance: 0,
		DistanceLabel:      "",
		IsBlood:            false,
		Dialect:            dialect,
		Path:               []string{},
	}, nil
}

// CalculateAllFrom resolves kinship terms from one reference member to EVERY
// member in graph g, returning a map of memberID → Vietnamese kinship term
// (Decision 2C batched labels). The reference member itself maps to
// "Bản thân"; members unreachable within the depth cap keep the engine's
// fallback term ("Không xác định được quan hệ") so the dictionary stays
// complete over the family roster.
func (e *Engine) CalculateAllFrom(g *Graph, fromID, dialect string) (map[string]string, error) {
	dialect = NormalizeDialect(dialect)

	if _, ok := g.Nodes[fromID]; !ok {
		return nil, fmt.Errorf("không tìm thấy thành viên bắt đầu: %s", fromID)
	}

	labels := make(map[string]string, len(g.Nodes))
	for nodeID := range g.Nodes {
		res, err := e.Calculate(g, fromID, nodeID, dialect)
		if err != nil {
			return nil, err
		}
		if res.Term == "" {
			continue
		}
		labels[nodeID] = res.Term
	}
	return labels, nil
}

func (e *Engine) containsSpouseEdge(g *Graph, path []string) bool {
	for i := 0; i < len(path)-1; i++ {
		u := path[i]
		v := path[i+1]
		for _, spID := range g.Spouses[u] {
			if spID == v {
				return true
			}
		}
	}
	return false
}

// findBloodPath ascends parent edges from both nodes, intersects ancestor sets,
// and finds the LCA with minimal total path distance (depth cap 12).
func (e *Engine) findBloodPath(g *Graph, fromID, toID string, depthCap int) ([]string, string) {
	fromAncestors := e.getAncestors(g, fromID, depthCap)
	toAncestors := e.getAncestors(g, toID, depthCap)

	// Intersect ancestor sets
	var bestLCA string
	bestDistance := 999999

	for ancID, fromPath := range fromAncestors {
		if toPath, ok := toAncestors[ancID]; ok {
			totalDist := fromPath.distance + toPath.distance
			if totalDist < bestDistance {
				bestDistance = totalDist
				bestLCA = ancID
			}
		}
	}

	if bestLCA == "" {
		return nil, ""
	}

	// Build path: from -> LCA -> to
	// fromAncestors[bestLCA].path is [from, ..., LCA]
	// toAncestors[bestLCA].path is [to, ..., LCA]
	fromP := fromAncestors[bestLCA].path
	toP := toAncestors[bestLCA].path

	fullPath := make([]string, 0, len(fromP)+len(toP)-1)
	fullPath = append(fullPath, fromP...)
	for i := len(toP) - 2; i >= 0; i-- {
		fullPath = append(fullPath, toP[i])
	}

	return fullPath, bestLCA
}

// getAncestors performs BFS ascending parent edges up to maxDepth.
// Node itself is included at depth 0.
func (e *Engine) getAncestors(g *Graph, startID string, maxDepth int) map[string]ancestorPath {
	results := make(map[string]ancestorPath)
	results[startID] = ancestorPath{
		ancestorID: startID,
		distance:   0,
		path:       []string{startID},
	}

	type queueItem struct {
		id    string
		depth int
		path  []string
	}

	q := []queueItem{{id: startID, depth: 0, path: []string{startID}}}

	for len(q) > 0 {
		curr := q[0]
		q = q[1:]

		if curr.depth >= maxDepth {
			continue
		}

		for _, pID := range g.Parents[curr.id] {
			newDepth := curr.depth + 1
			newPath := make([]string, len(curr.path)+1)
			copy(newPath, curr.path)
			newPath[len(curr.path)] = pID

			if existing, exists := results[pID]; !exists || newDepth < existing.distance {
				results[pID] = ancestorPath{
					ancestorID: pID,
					distance:   newDepth,
					path:       newPath,
				}
				q = append(q, queueItem{id: pID, depth: newDepth, path: newPath})
			}
		}
	}

	return results
}

// dijkstraItem for priority queue
type dijkstraItem struct {
	nodeID string
	dist   int
	path   []string
	index  int
}

type priorityQueue []*dijkstraItem

func (pq priorityQueue) Len() int           { return len(pq) }
func (pq priorityQueue) Less(i, j int) bool { return pq[i].dist < pq[j].dist }
func (pq priorityQueue) Swap(i, j int)      { pq[i], pq[j] = pq[j], pq[i]; pq[i].index = i; pq[j].index = j }
func (pq *priorityQueue) Push(x any) {
	n := len(*pq)
	item := x.(*dijkstraItem)
	item.index = n
	*pq = append(*pq, item)
}
func (pq *priorityQueue) Pop() any {
	old := *pq
	n := len(old)
	item := old[n-1]
	old[n-1] = nil
	item.index = -1
	*pq = old[0 : n-1]
	return item
}

// findDijkstraPath finds shortest path using blood edge=10, spouse edge=15
func (e *Engine) findDijkstraPath(g *Graph, fromID, toID string, maxDepth int) []string {
	dist := make(map[string]int)
	dist[fromID] = 0

	pq := &priorityQueue{}
	heap.Init(pq)
	heap.Push(pq, &dijkstraItem{nodeID: fromID, dist: 0, path: []string{fromID}})

	for pq.Len() > 0 {
		curr := heap.Pop(pq).(*dijkstraItem)

		if curr.nodeID == toID {
			return curr.path
		}

		if len(curr.path)-1 >= maxDepth {
			continue
		}

		if curr.dist > dist[curr.nodeID] {
			continue
		}

		for _, edge := range g.Adjacency[curr.nodeID] {
			w := 10
			if edge.Kind == EdgeSpouse {
				w = 15
			}
			newDist := curr.dist + w
			if curD, ok := dist[edge.TargetID]; !ok || newDist < curD {
				dist[edge.TargetID] = newDist
				newPath := make([]string, len(curr.path)+1)
				copy(newPath, curr.path)
				newPath[len(curr.path)] = edge.TargetID
				heap.Push(pq, &dijkstraItem{nodeID: edge.TargetID, dist: newDist, path: newPath})
			}
		}
	}

	return nil
}

// buildKinshipResult resolves deltaG, line, term, and distance_label from path
func (e *Engine) buildKinshipResult(
	g *Graph,
	fromNode, toNode *Node,
	path []string,
	lcaID string,
	isBlood bool,
	dialect string,
) model.KinshipResult {
	// 1. Calculate path-derived generation delta:
	// deltaG = (steps down to toNode) - (steps up from fromNode)
	// That is: generation(to) - generation(from)
	// For each step (u -> v):
	// if v is parent of u: deltaG++
	// if v is child of u: deltaG--
	// if v is spouse of u: deltaG += 0
	deltaG := 0
	for i := 0; i < len(path)-1; i++ {
		u := path[i]
		v := path[i+1]

		isParent := false
		for _, pID := range g.Parents[u] {
			if pID == v {
				isParent = true
				break
			}
		}

		isChild := false
		for _, cID := range g.Children[u] {
			if cID == v {
				isChild = true
				break
			}
		}

		if isParent {
			deltaG++
		} else if isChild {
			deltaG--
		}
	}

	genDist := deltaG
	if genDist < 0 {
		genDist = -genDist
	}

	distanceLabel := "Cùng thế hệ"
	if genDist > 0 {
		distanceLabel = fmt.Sprintf("Cách %d đời", genDist)
	}

	// 2. Line classification
	line := "Đồng tông"
	isPatrilineal := true

	if !isBlood {
		line = "Hôn phối"
	} else if genDist == 0 {
		line = "Đồng tông"
	} else {
		// Determine Patrilineal vs Matrilineal
		// Per specification: Patrilineal ("Chi nội") vs Matrilineal ("Chi ngoại")
		// is determined by examining connecting parent nodes.
		// If deltaG > 0 (toNode is ancestor or uncle/aunt):
		// look at fromNode's parent on path
		if deltaG > 0 {
			// Path starts: fromNode -> parent -> ...
			if len(path) > 1 {
				firstParent := g.Nodes[path[1]]
				if firstParent != nil && firstParent.Gender == model.GenderFemale {
					isPatrilineal = false
				}
			}
		} else {
			// deltaG < 0 (toNode is descendant, e.g. grandchild):
			// look at toNode's parent on path (the node right before toNode)
			if len(path) > 1 {
				parentOfTo := g.Nodes[path[len(path)-2]]
				if parentOfTo != nil && parentOfTo.Gender == model.GenderFemale {
					isPatrilineal = false
				}
			}
		}

		if isPatrilineal {
			line = "Chi nội"
		} else {
			line = "Chi ngoại"
		}
	}

	// 3. Seniority (birth year comparison when deltaG == 0 or for collateral)
	seniority := 0
	if toNode.BirthYear > 0 && fromNode.BirthYear > 0 {
		if toNode.BirthYear < fromNode.BirthYear {
			seniority = 1 // toNode born earlier => older
		} else if toNode.BirthYear > fromNode.BirthYear {
			seniority = -1 // toNode born later => younger
		}
	}

	// 4. Resolve Term
	term := e.resolveTermByRules(g, fromNode, toNode, path, lcaID, deltaG, isBlood, isPatrilineal, seniority, dialect)

	return model.KinshipResult{
		Term:               term,
		Line:               line,
		GenerationDistance: genDist,
		DistanceLabel:      distanceLabel,
		IsBlood:            isBlood,
		Dialect:            dialect,
		Path:               path,
	}
}

// resolveTermByRules maps exact family relationship to a Vietnamese kinship term
func (e *Engine) resolveTermByRules(
	g *Graph,
	fromNode, toNode *Node,
	path []string,
	lcaID string,
	deltaG int,
	isBlood bool,
	isPatrilineal bool,
	seniority int,
	dialect string,
) string {
	isDirect := (lcaID == fromNode.ID || lcaID == toNode.ID)

	if isBlood {
		switch deltaG {
		case 2: // Grandparents: Ông nội / Bà nội / Ông ngoại / Bà ngoại
			var subKey string
			if isPatrilineal {
				if toNode.Gender == model.GenderMale {
					subKey = "patri_male"
				} else {
					subKey = "patri_female"
				}
			} else {
				if toNode.Gender == model.GenderMale {
					subKey = "matri_male"
				} else {
					subKey = "matri_female"
				}
			}
			return e.lexicon.ResolveTerm(dialect, true, false, 2, isDirect, isPatrilineal, toNode.Gender, seniority, subKey)

		case 1: // Parents or Uncle/Aunt
			if isDirect {
				// Father / Mother
				var subKey string
				if toNode.Gender == model.GenderMale {
					subKey = "direct_male"
				} else {
					subKey = "direct_female"
				}
				return e.lexicon.ResolveTerm(dialect, true, false, 1, true, isPatrilineal, toNode.Gender, seniority, subKey)
			}
			// Collateral: Uncle / Aunt (Bác / Chú / Cô / Cậu / Dì)
			// Need relative seniority between the connecting parent and toNode
			// The connecting parent of fromNode is path[1]
			parentOfFrom := g.Nodes[path[1]]
			isOlderThanParent := false
			if parentOfFrom != nil && toNode.BirthYear > 0 && parentOfFrom.BirthYear > 0 {
				isOlderThanParent = toNode.BirthYear < parentOfFrom.BirthYear
			}

			var subKey string
			if isPatrilineal {
				// Father's side
				if isOlderThanParent {
					if toNode.Gender == model.GenderMale {
						subKey = "patri_older_male"
					} else {
						subKey = "patri_older_female"
					}
				} else {
					if toNode.Gender == model.GenderMale {
						subKey = "patri_younger_male"
					} else {
						subKey = "patri_younger_female"
					}
				}
			} else {
				// Mother's side
				if isOlderThanParent {
					if toNode.Gender == model.GenderMale {
						subKey = "matri_older_male"
					} else {
						subKey = "matri_older_female"
					}
				} else {
					if toNode.Gender == model.GenderMale {
						subKey = "matri_younger_male"
					} else {
						subKey = "matri_younger_female"
					}
				}
			}
			return e.lexicon.ResolveTerm(dialect, true, false, 1, false, isPatrilineal, toNode.Gender, seniority, subKey)

		case 0: // Siblings or cousins
			var subKey string
			if seniority > 0 {
				if toNode.Gender == model.GenderMale {
					subKey = "older_male"
				} else {
					subKey = "older_female"
				}
			} else if seniority < 0 {
				if toNode.Gender == model.GenderMale {
					subKey = "younger_male"
				} else {
					subKey = "younger_female"
				}
			} else {
				if toNode.Gender == model.GenderMale {
					subKey = "same_male"
				} else {
					subKey = "same_female"
				}
			}
			return e.lexicon.ResolveTerm(dialect, true, false, 0, isDirect, isPatrilineal, toNode.Gender, seniority, subKey)

		case -1: // Children or nephews/nieces
			var subKey string
			if isDirect {
				if toNode.Gender == model.GenderMale {
					subKey = "direct_male"
				} else {
					subKey = "direct_female"
				}
			} else {
				if toNode.Gender == model.GenderMale {
					subKey = "collateral_male"
				} else {
					subKey = "collateral_female"
				}
			}
			return e.lexicon.ResolveTerm(dialect, true, false, -1, isDirect, isPatrilineal, toNode.Gender, seniority, subKey)

		case -2: // Grandchildren (Cháu nội / Cháu ngoại)
			var subKey string
			if isPatrilineal {
				if toNode.Gender == model.GenderMale {
					subKey = "patri_male"
				} else {
					subKey = "patri_female"
				}
			} else {
				if toNode.Gender == model.GenderMale {
					subKey = "matri_male"
				} else {
					subKey = "matri_female"
				}
			}
			return e.lexicon.ResolveTerm(dialect, true, false, -2, isDirect, isPatrilineal, toNode.Gender, seniority, subKey)

		case -3: // Great-grandchildren (Chắt)
			return e.lexicon.ResolveTerm(dialect, true, false, -3, isDirect, isPatrilineal, toNode.Gender, seniority, string(toNode.Gender))

		case -4: // Great-great-grandchildren (Chút)
			return e.lexicon.ResolveTerm(dialect, true, false, -4, isDirect, isPatrilineal, toNode.Gender, seniority, string(toNode.Gender))
		}
	} else {
		// Affinal relations
		switch deltaG {
		case 0:
			var subKey string
			if seniority > 0 {
				if toNode.Gender == model.GenderMale {
					subKey = "older_male"
				} else {
					subKey = "older_female"
				}
			} else {
				if toNode.Gender == model.GenderMale {
					subKey = "younger_male"
				} else {
					subKey = "younger_female"
				}
			}
			term := e.lexicon.ResolveTerm(dialect, false, false, 0, false, false, toNode.Gender, seniority, subKey)
			if term != "" {
				return term
			}
		case 1:
			var subKey string
			if toNode.Gender == model.GenderMale {
				subKey = "patri_older_male"
			} else {
				subKey = "patri_younger_female"
			}
			term := e.lexicon.ResolveTerm(dialect, false, false, 1, false, false, toNode.Gender, seniority, subKey)
			if term != "" {
				return term
			}
		case -1:
			var subKey string
			if toNode.Gender == model.GenderMale {
				subKey = "child_in_law_male"
			} else {
				subKey = "child_in_law_female"
			}
			term := e.lexicon.ResolveTerm(dialect, false, false, -1, false, false, toNode.Gender, seniority, subKey)
			if term != "" {
				return term
			}
		}
	}

	// Generic fallback
	if toNode.Gender == model.GenderMale {
		return "Họ hàng (Nam)"
	}
	return "Họ hàng (Nữ)"
}
